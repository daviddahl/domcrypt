(function($)
{
	$.extend(
		{
			notifier:{
				// variables
				defaults:{
					core:"notifier",
					duration:5000
				},
				skins:{
					base:"#_{position:fixed;top:5px;right:5px;font-family:Arial;z-index:9999;}\n",
					box:"#_ #-{float:left;clear:both;padding:10px 0;color:#FFFFFF;position:relative;width:250px;margin-bottom:5px;}\n#_ #- .bg{z-index:-1;position:absolute;top:0;width:100%;height:100%;background:#000000;opacity:.5;opacity:0.5;filter:alpha(opacity=50);}\n#_ #- h1, #_ #- p{clear:both;padding:0 10px;margin:0;font-size:24px;font-family:Arial;color:#FFFFFF;letter-spacing:0;}\n#_ #- p{font-size:16px;margin:5px 0}\n#_ #- p.time{font-size:10px;}\n#_ #- button{position:absolute;right:5px;top:5px;}",
					rounded:"#_ #- > div{border-radius:5px;-moz-border-radius:5px;-webkit-border-radius:5px;}\n",
					red:"#_ #-{color:#CC0000;}\n#_ #- .bg{background:#CC0000;}\n"
				},
				notices:{},

				// methods
				broadcast:function(properties)
				{
					this.core();

					var id;
					id	= "notice-" + this.timestamp();

					// set notices object
					var notice = this.notices[id] = {id:id};
					for(i in properties){notice[i] = properties[i]}

					// skin
					this.css(notice);

					// box
					$("#" + this.defaults.core).append(this.box(notice));
				},

				// core
				core:function()
				{
					var core	= this.defaults.core;
					return $("#" + core).length == 0 ? $('body').append("<div id=\"" + core + "\"></div>") : $("#" + core);
				},

				// box
				box:function(notice)
				{
					var box	= $("<div id=\"" + notice.id + "\"></div>");
					box.append($("<button></button>").append("x"));
					box.append($("<h1></h1>").append(notice.ttl));
					box.append($("<p></p>").append(notice.msg));
					box.append($("<p></p>").addClass("time").append(Date()));
					box.append($("<div></div>").addClass("bg"));
					box.hide().fadeIn();
					this.life(box, notice.id);
					this.events(box, notice.id);
					return box;
				},

				// events
				events:function(box, seed)
				{
					$(box).children("button").bind(
						'click',
						function()
						{
							var seed	= $(this).parent().attr("id");
							$.notifier.destroy(seed, true);
						}
					)
					$(box).bind(
						'mouseover',
						function()
						{
							if($.notifier.notices[$(this).attr("id")].interval)
							{
								var seed	= $(this).attr("id");
								$.notifier.destroy(seed)
							}
						}
					)

					$(box).bind(
						'mouseout',
						function()
						{
							$.notifier.life(this, $(this).attr("id"));
						}
					)
				},

				// life
				life:function(box, seed)
				{
					if(!this.notices[seed].duration){this.notices[seed].duration = this.defaults.duration}
					this.notices[seed].interval = {};
					this.notices[seed].interval	= setInterval(
						function()
						{
							(function(seed)
							{
								$.notifier.destroy(seed, true)
							})
							(seed)
						},
						this.notices[seed].duration
					)
				},

				// destroy
				destroy:function(seed, remove)
				{
					clearInterval($.notifier.notices[seed].interval);
					delete $.notifier.notices[seed].interval;
					if(remove == true){$("#" + seed).slideUp(250, function(){$(this).remove()});}
				},

				// css
				css:function(notice)
				{
					var css=""
					var skin;
					var style = $("<style></style>");

					skin	= !notice.skin ? ['base', 'box'] : ('base,box,' + notice.skin).split(",");
					for(var n = 0; n < skin.length; n++){css		+= this.skins[skin[n]].replace(/#_/g, "#" + this.defaults.core).replace(/#-/g, "#" + notice.id);}
					$("#" + this.defaults.core).prepend(style.append(css));
				},

				// timestamp
				timestamp:function()
				{
					return new Date().getTime();
				}
			}
		}
	)
})(jQuery);
