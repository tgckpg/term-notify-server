"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;
var qstr = cl.load( "notifysrv.utils.querystr" );

class EventArgs
{
	constructor()
	{
		this.Handled = false;
	}
}

module.exports = EventArgs;
