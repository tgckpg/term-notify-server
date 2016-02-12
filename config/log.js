var fs = require( "fs" );
var path = "logs/access.log";

module.exports = {
	handler: fs.createWriteStream(
		path, { flag: "w+" }
	)
};
