<html>
<head>
    <title><%- $mapArray.navigationBarTitleText%></title>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,user-scalable=no,initial-scale=1'>
    <link href="<%- $mapArray['frame.css']%>" rel="stylesheet" />
    <link href="<%- $mapArray['developer.css']%>" rel="stylesheet" />
</head>
<body>
    <div id="swanapi"></div>
    <script type="text/javascript">
        window.swanGlobal = undefined;
        window._envVariables = {
            sdkExtension: '',
            ctsServerAddress: {
                master: [],
                slave: []
            }
        };
        window.HOST = 'devtool';
        window.manifest = <%- JSON.stringify($mapArray)%>;
        window.appkey = "<%- $data.appKey%>";
        window.swanHost =  window.location.host;
        window.ENV = 'master';
        window.page = {};
        window.page.swanbox = {};
    </script>
    <script src="<%- $mapArray['slavebox.js']%>"></script>
    <script src="<%- $mapArray['masterbox.js']%>"></script>
    <script src="<%- $mapArray['developer.js']%>"></script>
    <script type="text/javascript">
        window.page.swanbox.appConfig = window.appConfig;
    </script>
    <script src="<%- $mapArray['master.js']%>"></script>
    <script src="<%- $mapArray['slave.js']%>"></script>
    <script src="<%- $mapArray['app.js']%>"></script>
    <script>
        window.informParentCid = window.setInterval(function (){
            if (window.name === 'webswan') {
                window.parent.postMessage('{"type": "master_ready_<%- $data.appKey%>"}','*');
            }
        }, 60);
        var masterRunListener = function (e) {
            try {
                var data = JSON.parse(e.data);
            } catch (e) {
                var data = {
                    type: e.data
                }
            }
            if (data.type === 'master_run') {
                window.removeEventListener('message', masterRunListener);
                clearInterval(window.informParentCid);
                window.startRunApp();
            }
        }
        window.addEventListener('message', masterRunListener);
        window.addEventListener('message', function (e) {
            try {
                var data = JSON.parse(e.data);
            } catch (e) {
                var data = {
                    type: e.data,
                    url: '',
                    index: 0,
                    pagePath: '',
                    text: ''
                }
            }
            if (data.type === 'request_switch_tab') {
                window.swan.switchTab({
                    url: data.url
                });
            }
        })
    </script>
    <script>
        window.parent.checkWebWhiteScreen && window.parent.checkWebWhiteScreen();
    </script>
</body>
</html>
