"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;
var qstr = cl.load( "notifysrv.utils.querystr" );

var EventArgs = cl.load( "notifysrv.eventargs.eventargs" );

class PostRequestEventArgs extends EventArgs
{
	constructor( QueryString )
	{
		super();
		this.Raw = QueryString;
	}

	get Data()
	{
		return qstr.queryStr( this.Raw );
	}
}

module.exports = PostRequestEventArgs;
