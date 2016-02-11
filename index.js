require( "./botanss/package" );
require( "./config/global" );

var cl = global.botanLoader;

var Dragonfly = cl.load( "botanss.Dragonfly" );
Dragonfly.defaultSphere = 999;


var cluster = require('cluster');
var numCPUs = 2;


if( cluster.isMaster )
{
	var clog = require( "./config/log" );
	var Masterfly = new Dragonfly( clog.handler );

	var procFock = function( c )
	{
		// fork and bind the message bus from masterfly
		c.fork().addListener( "message", Masterfly.messageBus );
	};

	var clusterDisconnect = function( worker )
	{
		if( worker.suicide === true )
		{
			Masterfly.Info( "Worker committed suicide" );
			Masterfly.Info( "Forking process ..." );
			procFock( cluster );
		}
		else
		{
			Masterfly.Info( "Worker died" );
		}
	};

	for( var i = 0; i < numCPUs; i ++ ) procFock( cluster );

	cluster.addListener( "disconnect", clusterDisconnect );
}
else
{
	Dragonfly = new Dragonfly();
	global.Dragonfly = Dragonfly;

	GLOBAL.X_SERVER_CLUSTER = cluster;

	var AppDomain = cl.load( "botanss.net.AppDomain" );
	var Httph = cl.load( "botanss.net.Http" );

	//* Host App
	var WebFrame = cl.load( "botanss.net.WebFrame" );

	// Define AppNS
	cl.rootNS( "notifyterm", "./notify-term" );
	cl.rootNS( "notifysrv", "./notifysrv" );

	var App = cl.load( "notifyterm.app" );

	new AppDomain( function( req, res )
	{
		var h = new Httph( req, res );
		new App( h ).run();
	}, 5000 );
	//*/
}
