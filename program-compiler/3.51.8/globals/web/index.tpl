<html>
<head>
    <title><%- $mapArray.navigationBarTitleText %></title>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,user-scalable=no,initial-scale=1'>
    <script src="https://s1.bdstatic.com/r/www/cache/ecom/esl/2-0-4/esl.js"></script>
</head>
<body ontouchstart="">
    <div id="sfr-app" class="web-swan-app">
        <div class="rt-view web-swan-view">
            <div class="rt-head web-swan-header current">
                    <link href="<%- $mapArray['frame.css'] %>" rel="stylesheet" />
                    <link href="<%- $mapArray['developer.css'] %>" rel="stylesheet" />
                    <script type="text/javascript">
                        if (!window.page) {
                            window.page = {};
                        }
                        if (!window.page.swanbox) {
                            window.page.swanbox = {};
                        }
                        window.page.swanbox.manifest = <%- JSON.stringify($mapArray) %>;
                        window.page.swanbox.appkey = "<%- $data.appKey %>";
                        window.page.swanbox.swanHost =  window.location.host;
                    </script>
                <div class="rt-back"></div>
                <div class="rt-title web-swan-title">
                    <span class="web-swan-title-loading"></span>
                    <span class="web-swan-title-text"></span>
                </div>
                <div class="rt-subtitle"></div>
                <div class="rt-actions"></div>
            </div>
            <div class="rt-body web-swan-body">
                <iframe style="display: none;" src="/master.html" name="webswan"></iframe>
                <div id="web-swan-page" class="web-swan-page"></div>
                <div id="web-swan-tabbar" class="web-swan-tabbar"></div>
                <div id="swanapi"></div>
                <script>
                    require.config({
                        paths: {
                            'miniapp-developer-<%- $data.appKey %>': "<%- $mapArray['developer.js'].replace('.js', '') %>",
                            'miniapp-slave' : "<%- $mapArray['slave.js'].replace('.js', '') %>"
                        },
                        shim: {
                            'miniapp-developer-<%- $data.appKey %>' : {
                                exports: 'developer'
                            }
                        }
                    });
                    define('miniapp-main-<%- $data.appKey %>', function (require) {
                            require("miniapp-developer-<%- $data.appKey %>");
                            require("miniapp-slave");
                        }
                    );
                    require(['miniapp-main-<%- $data.appKey %>'], function (main) {

                        if (main.cached) {
                            ['appConfig', 'appConfigObj', 'firstPageUrl', 'pagesMap', 'pagesConfig'].forEach(function(key) {
                                window.page.swanbox[key] = main.cached[key];
                            });
                        }
                        window.page.swanbox.init();
                        if (!main.cached) {
                            main.cached = {};
                            ['appConfig', 'appConfigObj', 'firstPageUrl', 'pagesMap', 'pagesConfig'].forEach(function(key) {
                                main.cached[key] = window.page.swanbox[key];
                            });
                        }


                        var iframe = document.querySelector('iframe[name=webswan]');
                        var iMessageAccepter = function (e) {
                            try {
                                var data = JSON.parse(e.data);
                            } catch (e) {
                                var data = {
                                    type: e.data
                                }
                            }
                            if (data.type === ('master_ready_<%- $data.appKey %>')) {
                                iframe.contentWindow.postMessage('{"type": "master_run"}','*');
                                window.removeEventListener('message', iMessageAccepter);
                            }
                        };
                        window.addEventListener('message', iMessageAccepter);
                    });
                </script>
            </div>
        </div>
    </div>
</div>
<div style="display: none">
    <%for(var i = 0; i < $mapArray.pagesList.length; i++) { %>
    <a href="/<%-$mapArray.pagesList[i]%>"></a>
    <%}%>
</div>
</body>
</html>
