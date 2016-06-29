"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var EventEmitter = require( "events" ).EventEmitter;

var HttpRequest = cl.load( "botanss.net.HttpRequest" );
var Rand = cl.load( "botansx.utils.random" );

var Notis = cl.load( "notifyterm.Notis" );
var Model = cl.load( "notifyterm.schema" );

// private static var
var AuthTokenName = "WNSAuthToken";
var AuthToken = false;

class WNSAuth extends EventEmitter
{
	constructor()
	{
		super();
		this.__inAuth = false;
	}

	get IsAuthenticated() { return Boolean( AuthToken ); }

	Authenticate()
	{
		if( this.IsAuthenticated )
		{
			this.__emitAuthComplete();
			return;
		}

		if( this.__inAuth ) return;

		this.__inAuth = true;
		var _self = this;

		Model.Tokens.findOne({ name: AuthTokenName, date_created: { $gt: Date.now() - 83200 } })
		.exec( ( err, data ) => {
			if( err || !( data && data.token ) )
			{
				Dragonfly.Info( "Database does not contain access token, authenticating" );
				_self.__authWNS();
			}
			else
			{
				Dragonfly.Info( "Access token found in database, using it" );
				AuthToken = data.token;
				_self.__emitAuthComplete();
			}
		} );
	}

	Register( uuid, ChannelUri, handler )
	{
		var _self = this;
		var VerifyChannel = () =>
		{
			var N = new Notis({
				id: "Null"
				, title: "Channel Registration"
				, message: "Registration success"
			});

			if( uuid )
			{
				Dragonfly.Info( "Renewal request: " + uuid );
				this.__updateToken( uuid, ChannelUri, handler );
				return;
			}

			uuid = Rand.uuid();

			Dragonfly.Debug( "ChannelUri: " + ChannelUri );

			_self.__send( ChannelUri, N, ( sender, e ) => {

				if( typeof( e ) == "string" )
				{
					handler( _self, e );
					return;
				}

				if( e.statusCode == 200 )
				{
					this.__updateToken( uuid, ChannelUri, handler );
					return;
				}

				Dragonfly.Debug( e.statusCode + ": " + e.ResponseString );
				handler( _self, e.statusCode + " Server Error: Unable to push message to channel" );
			} );
		};

		if( !this.Authenticated )
		{
			this.once( "AuthComplete", VerifyChannel );
			this.Authenticate();
		}
		else
		{
			VerifyChannel();
		}
	}

	Unregister( uuid, handler )
	{
		if( uuid == AuthTokenName )
		{
			handler( "Malicious action: Trying to remove AuthToken" );
			return;
		}

		Model.Tokens.remove({ name: uuid }).exec( handler );
	}

	Deliver( NotisQ )
	{
		var _self = this;
		Model.Tokens
		.findOne({ name: NotisQ.id, expired: false })
		.exec( ( err, data ) => {
			if( err )
			{
				Dragonfly.Error( err );
				return;
			}

			if( data && data.token )
			{
				this.__send( data.token, NotisQ, ( sender, e ) => {
					Dragonfly.Debug( "Send: " + e.statusCode );

					switch( e.statusCode )
					{
						case 200: break;
						case 410:
							Dragonfly.Info( "Channel is expired: " + NotisQ.id  );
							data.expired = true;
							data.save( x => {
								Dragonfly.Info( "Mark expired: " + NotisQ.id );
							});

							break;

						default:
							AuthToken = null;
							Dragonfly.Info( "Perhaps access token is expired, retrying ..." );

							if( NotisQ.Retry < 2 )
							{
								_self.once( "AuthComplete", () => {
									NotisQ.Retry ++;
									_self.Deliver( NotisQ );
								});
							}
							else
							{
								Dragonfly.Info( "Retrying exceeded the limit, dropping the message" );
							}

							_self.Authenticate();
					}
				} );
			}
			else
			{
				Dragonfly.Info( "Channel not found: " + NotisQ.id );
			}
		} );
	}

	__updateToken( uuid, ChannelUri, handler )
	{
		var _self = this;
		Model.Tokens.update(
			{ name: uuid }
			, {
				name: uuid
				, token: ChannelUri
				, date_created: Date.now()
				, expired: false
			}
			, { upsert: true }
		)
		.exec( ( err, data ) => {

			if( err )
			{
				Dragonfly.Error( err );
				handler( _self, "Server Error: Cannot save channel information" );
				return;
			}

			// Success
			handler( _self, uuid );
			Dragonfly.Info( "Register: " + uuid );
		} );
	}

	__send( ChannelUri, NotisQ, handler )
	{
		if( !ChannelUri )
		{
			handler( this, "Channel is undefined" );
			return;
		}

		try
		{
			var Request = new HttpRequest( ChannelUri, {
				"Authorization":  "Bearer " + AuthToken
				, "X-WNS-RequestForStatus": "true"
				, "X-WNS-Type": "wns/toast"
			} );

			if( !Request.Hostname.match( /.*\.notify\.windows\.com$/ ) )
			{
				handler( this, "Malicious hostname: " + Request.Hostname );
				return;
			}

			Request.PostData( NotisQ.Xml );
			Request.Headers[ "Content-Type" ] = "text/xml";

			Request.addListener( "RequestComplete", handler );

			Request.Send();
		}
		catch( ex )
		{
			handler( this, ex.message );
			return;
		}
	}

	__authWNS()
	{
		var serviceAuth = cl.load( "notifyterm.config.auth", true );

		var Request = new HttpRequest( serviceAuth.Uri );

		Request.PostData(
			"grant_type=client_credentials"
			+ "&client_id=" + serviceAuth.Id 
			+ "&client_secret=" + encodeURIComponent( serviceAuth.Secret )
			+ "&scope=notify.windows.com"
		);

		Request.addListener( "RequestComplete", this.__requestComplete.bind( this ) );

		Request.Send();
	}

	__requestComplete( sender, e )
	{
		var _self = this;
		let JResponse = JSON.parse( e.ResponseString );

		if( JResponse && JResponse.access_token )
		{
			AuthToken = JResponse.access_token;
			Dragonfly.Info( "Authorization Success" );

			Dragonfly.Debug( AuthTokenName + ": " + AuthToken );
			Model.Tokens
				.update(
					{ name: AuthTokenName }
					, { name: AuthTokenName, token: AuthToken, date_created: Date.now() }
					, { upsert: true }
				)
				.exec( ( err, data ) => {
					if( err ) Dragonfly.Error( err );
					_self.__emitAuthComplete();
				});
		}
		else
		{
			Dragonfly.Error( "Unable to authenticate: " + e.ResponseString );
			_self.__emitAuthComplete();
		}
	}

	__emitAuthComplete()
	{
		this.__inAuth = false;
		this.emit( "AuthComplete", this );
	}

}

module.exports = WNSAuth;
