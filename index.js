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

        // Matches url which looks like /rest-api/latest-version/[release|build]
        let match = /^\/rest\/latest-version\/(release|build)\/?(\?.*)?$/gm.exec(req.url);
        if (match !== null) {
            let versionType = match[1];
            // Show the latest version
            return showLatestRelease(res, versionType);
        }

        // Matches url which look like /api and similar
        match = /^\/(api|core)\/?(\?.*)?$/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            // Redirect to the latest snapshot
            return redirectToLatestRelease(res, type);
        }

        // Matches url which look like /build/latest and similar
        match = /^\/(api|core)\/build\/latest\/?/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            // Redirect to the latest snapshot
            return redirectToLatestSnapshot(res, type);
        }

        // Matches url which look like /v/latest and similar
        match = /^\/(api|core)\/v\/latest\/?/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            // Redirect to the latest snapshot
            return redirectToLatestRelease(res, type);
        }

        // Matches urls which start with /build/1234/ (1234 = any build id)
        match = /^\/(api|core)\/build\/(\d+)\/?/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let buildId = match[2];
            return proxyJavadocsByBuildId(res, req, buildId, type, 'Javacord_PublishSnapshots');
        }

        // Like above, but without the slash at the end
        match = /^\/(api|core)\/build\/(\d+)/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let buildId = match[2];
            // We want an url which ends with a slash
            return redirect(res, `/${type}/build/${buildId}/`);
        }

        // Matches urls which start with /v/1.2.3/ (1.2.3 = any version number)
        match = /^\/(api|core)\/v\/([\d\\.]+)\//gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let versionNumber = match[2];
            return proxyJavadocsByVersionNumber(res, req, versionNumber, type);
        }

        // Like above, but without the slash at the end
        match = /^\/(api|core)\/v\/([\d\\.]+)/gm.exec(req.url);
        if (match !== null) {
            let type = match[1];
            let versionNumber = match[2];
            // We want an url which ends with a slash
            return redirect(res, `/${type}/v/${versionNumber}/`);
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
 * Renders a rest page.
 *
 * @param res The response to which the site should be sent.
 * @param jsonData The data to display.
 */
function renderRestPage(res, jsonData) {
    res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.write(JSON.stringify(jsonData));
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
 * Redirects to the latest version.
 *
 * @param res The response to redirect.
 * @param type The type, either 'api' or 'core'
 */
function redirectToLatestRelease(res, type) {
    getLatestRelease(function (error, versionNumber) {
        if (error) {
            return renderErrorPage(res, `Error: ${error.message}`);
        }
        return redirect(res, `/${type}/v/${versionNumber}/`);
    });
}

/**
 * Redirects to the latest snapshot.
 *
 * @param res The response to redirect.
 * @param versionType The version type, either 'release' or 'build'
 */
function showLatestRelease(res, versionType) {
    if (versionType.toLowerCase() === 'build') {
        getLatestBuildId(function (error, buildId) {
            if (error) {
                return renderErrorPage(res, `Error: ${error.message}`);
            }
            return renderRestPage(res, {
                build_id: buildId
            });
        });
    } else {
        getLatestRelease(function (error, versionNumber) {
            if (error) {
                return renderErrorPage(res, `Error: ${error.message}`);
            }
            return renderRestPage(res, {
                version: versionNumber
            });
        });
    }
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
 * Proxies sites.
 *
 * @param res The response to which the site should be sent.
 * @param req The request.
 * @param versionNumber The version number.
 * @param type The type, either 'api' or 'core'
 */
function proxyJavadocsByVersionNumber(res, req, versionNumber, type) {
    getAllReleases(function (error, versions) {
        if (error) {
            return renderErrorPage(res, `Error: ${error.message}`);
        }
        for (let version in versions) {
            if (!versions.hasOwnProperty(version)) {
                continue;
            }
            if (version === versionNumber) {
                return proxyJavadocsByBuildId(res, req, versions[version], type, 'Javacord_Release');
            }
        }
        render404Page(res);
    });
}

/**
 * Proxies sites.
 *     
 * @param res The response to which the site should be sent.
 * @param req The request.
 * @param buildId The build id.
 * @param type The type, either 'api' or 'core'
 * @param project Either 'Javacord_UpdateCommitStatus' or 'Javacord_Release'
 */
function proxyJavadocsByBuildId(res, req, buildId, type, project) {
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
        let urlAppendix = req.url.replace(`/${type}/build/${buildId}`, '').replace(/\/(api|core)\/v\/[\d\\.]+/, '');
        urlAppendix = urlAppendix === '' || urlAppendix === '/' ? '/index.html' : urlAppendix;
        console.log(`https://ci.javacord.org/repository/download/${project}/${buildId}:id/javacord-${type}/${fileName}%21${urlAppendix}`);
        return proxySite(res, `https://ci.javacord.org/repository/download/${project}/${buildId}:id/javacord-${type}/${fileName}%21${urlAppendix}`);
    });
}

/**
 * Gets all release versions.
 *
 * @param callback A object, with fields where the key is the version number and the value the build id.
 */
function getAllReleases(callback) {
    let options = {
        url: 'https://ci.javacord.org/app/rest/builds/?locator=buildType:(id:Javacord_Release),status:SUCCESS&guest=1',
        headers: { 'Accept': 'application/json' }
    };
    request(options, function (error, response, body) {
        if (error) {
            return callback(error);
        }
        try {
            let versions = {};
            let jsonBody = JSON.parse(body);
            for (let i = 0; i < jsonBody.build.length; i++) {
                let build = jsonBody.build[i];
                versions[build.number.split(' ')[0]] = build.id;
            }
            return callback(null, versions);
        } catch (e) {
            return callback(e);
        }
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
 * Gets the latest release build id.
 *
 * @param callback The callback.
 */
function getLatestRelease(callback) {
    let options = {
        url: 'https://ci.javacord.org/app/rest/builds/buildType:(id:Javacord_Release),status:SUCCESS?guest=1',
        headers: { 'Accept': 'application/json' }
    };
    request(options, function (error, response, body) {
        if (error) {
            return callback(error);
        }
        try {
            return callback(null, JSON.parse(body).number.split(' ')[0]);
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
        response.headers['Access-Control-Allow-Origin'] = '*';
        res.writeHead(response.statusCode, response.headers);
        res.write(body);
        res.end();
    });
}