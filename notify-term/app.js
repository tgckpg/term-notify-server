"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var HttpRequest = cl.load( "botanss.net.HttpRequest" );
var Base = cl.load( "notifysrv.postframe" );

var WNSAuth = cl.load( "notifyterm.WNSAuth" );
var Model = cl.load( "notifyterm.schema" );
var NotisQ = cl.load( "notifyterm.Notis" );
var SrvAuth = cl.load( "notifyterm.config.auth" );

class App extends Base
{
	constructor( Http )
	{
		super( Http );
		this.result = "Hello there! This is a notify-term server.\nFor more information please head to https://github.com/tgckpg/notify-term";

		this.OAuth = new WNSAuth();
		this.OAuth.addListener( "AuthComplete", this.OnAuthed.bind( this ) );
		this.OAuth.Authenticate();
		this.RequestQueue = [];

		this.addListener( "PostRequest", this.PostRequest );
	}

	PostRequest( sender, e )
	{
		e.Handled = true;

		var _self = this;
		var query = e.Data;

		// Protected Actions
		switch( query.action )
		{
			case "register":
			case "remove":
				if(!( query.pass && query.pass == SrvAuth.Client ))
				{
					this.result = "Unauthorized Access";
					this.plantResult();
					return;
				}
				break;
		}

		switch( query.action )
		{
			case "register":
				this.OAuth.Register(
				query.uri, ( sender, mesg ) => {
					_self.result = mesg;
					_self.plantResult();
				} );
				break;

			case "deliver":
				this.__sendMesg( query );
				break;

			case "remove":
				this.OAuth.Unregister( query.id, ( err, data ) => {

					if( err )
					{
						Dragonfly.Error( err );
					}
					else
					{
						Dragonfly.Debug( "Removed " + query.id + ": " + data );
					}

					_self.result = "OK";
					_self.plantResult();
				} );
				break;
			default:
				this.result = "Invalid Action";
				this.plantResult();
		}
	}

	__sendMesg( query )
	{
		var N = new NotisQ( query );
		if( N.Valid )
		{
			this.RequestQueue.push( N );
			this.result = "Your message has been queued";
		}
		else
		{
			this.result = "Invalid message format";
		}

		this.plantResult();
		this.OAuth.Authenticate();
	}

	OnAuthed( OAuth )
	{
		if( !OAuth.IsAuthenticated )
		{
			Dragonfly.Error( "Unable to authenticate" );
		}

		this.ProcessQueue();
	}

	ProcessQueue()
	{
		if(!( this.RequestQueue && this.RequestQueue.length ))
		{
			this.RequestQueue = [];
			return;
		}

		var Request = this.RequestQueue.shift();
		this.OAuth.Deliver( Request );
	}
}

module.exports = App;
