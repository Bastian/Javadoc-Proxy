const http = require('http');
const request = require('request');
const async = require('async');

// Log all uncaught exceptions
process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err);
});

// Create a new server on port 80
http.createServer(function (req, res) {

    try {
        // Matches the root of the page, e.g. '', '/', '?a=b', '/?a=b'
        if (/^\/?(\?.*)?$/gm.exec(req.url) !== null) {
            // Redirect to the latest snapshot
            return redirectToLatestSnapshot(res, 'api');
        }

        // Matches url which look like /api and similar
        let match = /^\/(api|core)\/?(\?.*)?$/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            // Redirect to the latest snapshot
            return redirectToLatestSnapshot(res, type);
        }

        // Matches url which look like /build/latest and similar
        match = /^\/(api|core)\/build\/latest\/?/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            // Redirect to the latest snapshot
            return redirectToLatestSnapshot(res, type);
        }

        // Matches urls which start with /build/1234/ (1234 = any build id)
        match = /^\/(api|core)\/build\/(\d+)\//gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let buildId = match[2];
            return proxyJavadocsByBuildId(res, req, buildId, type);
        }

        // Like above, but without the slash at the end
        match = /^\/(api|core)\/build\/(\d+)/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let buildId = match[2];
            // We want an url which ends with a slash
            return redirect(res, `/${type}/build/${buildId}/`);
        }

        // If no type/artifact was given, redirect to api
        match = /^\/build\/(\d+|latest)/gm.exec(req.url);
        if (match !== null) {
            let buildId = match[1];
            // We want an url which ends with a slash
            return redirect(res, `/api/build/${buildId}/`);
        }

        return render404Page(res);
    } catch (e) {
        return renderErrorPage(res, `Error: ${e.message}`);
    }

}).listen(80);

/**
 * Renders a 500 page.
 *
 * @param res The response to which the site should be sent.
 * @param message The message to display.
 */
function renderErrorPage(res, message) {
    // TODO make this fancier
    res.writeHead(500);
    res.write(message);
    res.end();
}

/**
 * Renders the 404 page.
 *
 * @param res The response to which the site should be sent.
 */
function render404Page(res) {
    // TODO make this fancier
    res.writeHead(404);
    res.write('Not found :-(');
    res.end();
}

/**
 * Redirects to the latest snapshot.
 *
 * @param res The response to redirect.
 * @param type The type, either 'api' or 'core'
 */
function redirectToLatestSnapshot(res, type) {
    getLatestBuildId(function (error, buildId) {
        if (error) {
            return renderErrorPage(res, `Error: ${error.message}`);
        }
        return redirect(res, `/${type}/build/${buildId}/`);
    });
}

/**
 * Redirects to the given url.
 *
 * @param res The response to redirect.
 * @param url The url to which the redirect should point.
 */
function redirect(res, url) {
    res.writeHead(302, {
        'Location': url,
        'Access-Control-Allow-Origin': '*'
    });
    res.end();
}

/**
 * Proxies sites with the following pattern: /build/<buildId>
 *     
 * @param res The response to which the site should be sent.
 * @param req The request.
 * @param buildId The build id.
 * @param type The type, either 'api' or 'core'
 */
function proxyJavadocsByBuildId(res, req, buildId, type) {
    async.waterfall([
        function (callback) {
            let options = {
                url: `https://ci.javacord.org/app/rest/builds/id:${buildId}/artifacts/javacord-${type}?guest=1`,
                headers: { 'Accept': 'application/json' }
            };
            request(options, callback);
        },
        function (response, body, callback) {
            if (response.statusCode < 200 || response.statusCode > 299) {
                return callback(null, null);
            }
            let fileName = null;
            let jsonBody = JSON.parse(body);
            // Search for the javadoc artifact (ends with -javadoc.jar)
            for (let i = 0; i < jsonBody.file.length; i++) {
                let file = jsonBody.file[i];
                if (file.name.endsWith('-javadoc.jar')) {
                    fileName = file.name;
                }
            }
            callback(null, fileName);
        }
    ], function (error, fileName) {
        if (error) {
            return renderErrorPage(res, `Error: ${error.message}`);
        }
        if (fileName === null) {
            return render404Page(res);
        }
        let urlAppendix = req.url.replace(`/${type}/build/${buildId}`, '');
        urlAppendix = urlAppendix === '' || urlAppendix === '/' ? '/index.html' : urlAppendix;
        return proxySite(res, `https://ci.javacord.org/repository/download/Javacord_UpdateCommitStatus/${buildId}:id/javacord-${type}/${fileName}%21${urlAppendix}`);
    });
}

/**
 * Gets the latest build id.
 * 
 * @param callback The callback.
 */
function getLatestBuildId(callback) {
    let options = {
        url: 'https://ci.javacord.org/app/rest/builds/buildType:(id:Javacord_PublishSnapshots),status:SUCCESS,branch:v_3?guest=1',
        headers: { 'Accept': 'application/json' }
    };
    request(options, function (error, response, body) {
        if (error) {
            return callback(error);
        }
        try {
            return callback(null, JSON.parse(body).id);
        } catch (e) {
            return callback(e);
        }
    });
}

/**
 * Proxies the given site.
 *
 * @param res The response to which the site should be sent.
 * @param url The url which should be proxied.
 */
function proxySite(res, url) {
    request({
        url: url
    }, function (error, response, body) {
        res.writeHead(response.statusCode, response.headers);
        res.write(body);
        res.end();
    });
}