"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var HttpRequest = cl.load( "botanss.net.HttpRequest" );
var ustr = cl.load( "notifysrv.utils.string" );

class Notis 
{
	constructor( query )
	{
		this.__valid = false;
		this.__error = null;

		try
		{
			if( !query.id )
			{
				throw new Error( "ID is not specified" );
			}

			this.id = query.id;

			if( query.xml )
			{
				this.Xml = query.xml;
			}
			else
			{
				this.Xml = Notis.ToastText02
					.replace( "{TITLE}", ustr.encodeHtml( query.title ) )
					.replace( "{MESG}", ustr.encodeHtml( query.message ) );
			}

			this.__valid = true;
		}
		catch( ex )
		{
			Dragonfly.Error( ex );
			this.__error = ex.message;
		}
	}

	get Valid() { return this.__valid; }
	get Error() { return this.__error; }

	static get ToastText02()
	{
		return `
<toast>
	<visual>
		<binding template="ToastText02">
			<text id="1">{TITLE}</text>
			<text id="2">{MESG}</text>
		</binding>
	</visual>
</toast>
`;
	}

}

module.exports = Notis;
