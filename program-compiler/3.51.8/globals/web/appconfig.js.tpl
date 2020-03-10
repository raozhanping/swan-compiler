void function (localScope) {

    localScope.appConfig = <%- JSON.stringify(appConfig) %>;

}(window.ENV === 'master' ? window : window.page.swanbox);