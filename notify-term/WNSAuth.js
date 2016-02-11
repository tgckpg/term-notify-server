"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var EventEmitter = require( "events" ).EventEmitter;

var HttpRequest = cl.load( "botanss.net.HttpRequest" );
var Rand = cl.load( "notifysrv.utils.random" );
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

		Model.Tokens.findOne({ name: AuthTokenName })
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

	Register( ChannelUri, handler )
	{
		var _self = this;
		var VerifyChannel = () =>
		{
			var N = new Notis({
				id: "Null"
				, title: "Channel Registration"
				, message: "Registration success"
			});

			var uuid = Rand.uuid();

			_self.__send( ChannelUri, N, ( sender, e ) => {
				if( e.statusCode == 200 )
				{
					Model.Tokens.update(
						{ name: uuid }
						, { name: uuid, token: ChannelUri }
						, { upsert: true }
					)
					.exec( ( err, data ) => {
						if( err )
						{
							Dragonfly.Error( err );
							handler( _self, "Server Error: Cannot save channel information" );
							return;
						}
						handler( _self, uuid );
					} );
					return;
				}

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

	Deliver( NotisQ )
	{
		Model.Tokens
		.findOne({ name: NotisQ.id })
		.exec( ( err, data ) => {
			if( err )
			{
				Dragonfly.Error( err );
				return;
			}

			if( data && data.token )
			{
				this.__send( data.token, NotisQ, ( sender, e ) => {
					Dragonfly.Debug( e.Data );
				} );
			}
			else
			{
				Dragonfly.Info( "Channel not found: " + NotisQ.id );
			}
		} );
	}

	__send( ChannelUri, NotisQ, handler )
	{
		if( !ChannelUri )
		{
			handler( this, "Channel is undefined" );
			return;
		}

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

	__authWNS()
	{
		var serviceAuth = cl.load( "notifyterm.config.auth" );

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

			Model.Tokens
				.update(
					{ name: AuthTokenName }
					, { name: AuthTokenName, token: AuthToken }
					, { upsert: true }
				)
				.exec( ( err, data ) => _self.__emitAuthComplete() );
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
