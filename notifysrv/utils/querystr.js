module.exports = {
	queryStr: function( qstr )
	{
		var qObj = {};

		qstr.split( "&" ).forEach( function( val )
		{
			val = val.split( "=" );
			qObj[ val[0] ] = val[1] ? decodeURIComponent( val[1].replace( /\+/g, " " ) ) : true;
		} );

		return qObj;
	}
};
