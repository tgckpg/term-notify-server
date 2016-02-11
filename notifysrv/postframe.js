"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var PostRequestEventArgs = cl.load( "notifysrv.eventargs.postrequest" );
var EventEmitter = require( "events" ).EventEmitter;

class PostFrame extends EventEmitter
{
	constructor( Http )
	{
		super();
		this.HTTP = Http;
		this.result = "Error: PostFrame is unhandled";
		this.planted = false;
	}

	run()
	{
		var _self = this;
		var requestStr = "";

		if( this.HTTP.request.isPost )
		{
			var Req = this.HTTP.request.raw;

			var ReceiveData = function( data )
			{
				requestStr += data + "";
				if( 51200 < requestStr.length )
				{
					_self.result = "The size of request is too big ( 500KB < )";
					Req.removeListener( "data", ReceiveData );
					Req.removeListener( "end", ReceiveEnd );

					_self.plantResult();
				}
			};

			var ReceiveEnd = function()
			{
				var EventArgs = new PostRequestEventArgs( requestStr );

				_self.emit( "PostRequest", this, EventArgs );
				if( !EventArgs.Handled )
				{
					_self.result = "Error: Unhandled Request";
					_self.plantResult();
				}
			};

			Req.addListener( "data", ReceiveData );
			Req.addListener( "end", ReceiveEnd );
			return;
		}
		else
		{
			Dragonfly.Info(
				"GET: " + encodeURI( this.HTTP.request.raw.url )
				+ " - " + this.HTTP.request.raw.headers["user-agent"]
				, Dragonfly.Visibility.VISIBLE
			);
		}

		this.plantResult();
	}

	plantResult()
	{
		if( !this.planted )
		{
			this.planted = true;
			if( this.HTTP )
			{
				if( !( this.result instanceof Buffer ) )
				{
					this.result = String( this.result );
				}

				this.HTTP.response.headers["Content-Type"] = "text/plain";
				this.HTTP.response.headers["Content-Length"] = this.result.length;
				this.HTTP.response.write( this.result );
				this.HTTP.response.end();
			}

		}
	}
}

module.exports = PostFrame;
