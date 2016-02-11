var Dragonfly = global.Dragonfly;
var cl = global.botanLoader; 
var util = require( "util" );
var events = require( "events" );
var mongoose = require( "mongoose" );
	var Schema = mongoose.Schema;

var options = cl.load( "notifyterm.config.db" );

var throwEverything = function( err ) {
	if( err ) {
		throw err;
	}
};

var db = mongoose.connection;
db.on( "error", throwEverything );

mongoose.connect( options.host, options.auth );

/* Schema Heads */
var R_Tokens = { type: Schema.Types.ObjectId, ref: "Tokens" };
/* End Schema Heads */

var M_Tokens = new Schema({
	name: { type: String, unique: true }
	, token: { type: String }
	, date_created: {
		type: Date
		, default: Date.now
	}
});


var DB = function ()
{
	events.EventEmitter.call( this );
	var Models = [
		  { name: "Tokens" , schema: M_Tokens , hasKey: true }
	];

	var l = Models.length;

	var _widx = 0;
	var _widxl = 0;

	var _self = this;

	var ready = function()
	{
		_self.ready = true;
		_self.emit( "ready", _self );
	};

	var waitIndex = function( err )
	{
		_widx ++;
		throwEverything( err );
		if( _widx == _widxl ) ready();
	};

	this.ready = false;

	for( var i = 0; i < l; i ++ )
	{
		var mod = Models[i];
		var b = mongoose.model( mod.name, mod.schema );
		if( mod.hasKey )
		{
			_widxl ++;
			b.on( "index", waitIndex );
		}
		this[ mod.name ] = b;
	}

	if( !_widxl ) ready();
};

util.inherits( DB, events.EventEmitter );

module.exports = new DB();
