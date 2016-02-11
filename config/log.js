var fs = require( "fs" );
var path = "logs/access.log";

module.exports = {
	handler: { write: function( e ) { process.stdout.write( e ); } }
};
