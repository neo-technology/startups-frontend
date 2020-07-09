import { WebAuth } from 'auth0-js'

const API_BASE_URL = "{{API_BASE_URL}}";
const neo4j_inc_license_url = 'https://s3.amazonaws.com/neo4j-startup-licenses/neo4j-inc-startup-license.pdf?versionId=yrmKdHboCHjs2r1epvUUmwaUobf0.p89';
const neo4j_ab_license_url = 'https://s3.amazonaws.com/neo4j-startup-licenses/neo4j-ab-startup-license.pdf?versionId=24j4bDcgXNH51xTExlMfL5iXFwyAJ7TC';
const auth = new WebAuth({
	clientID: 'hoNo6B00ckfAoFVzPTqzgBIJHFHDnHYu',
	domain: 'login.neo4j.com',
	redirectUri: `${window.location.origin}/accounts/login`,
	audience: 'neo4j://accountinfo/',
	scope: 'read:account-info openid email profile user_metadata',
	responseType: 'token id_token'
})

Sentry.init({ dsn: 'https://9a2dd82a420e4115aca3cc605e6131f7@sentry.io/1385360' });

const truncateDateTime = function (dateTimeStr) {
	if (typeof dateTimeStr == 'string') {
		return dateTimeStr.substring(0, 10);
	} else {
		return dateTimeStr;
	}
}

window._neo4jStartup = {};

// Function called from HTML
window._neo4jStartup.regionChange = function () {
	const region = $('#company-region').val();
	if (region == 'europe') {
		$('#license-url').val(neo4j_ab_license_url);
		$('#license-url-link').attr('href', neo4j_ab_license_url);
		$('#license-url-link').text('Terms of the Startup Program (Europe)');
	} else {
		$('#license-url').val(neo4j_inc_license_url);
		$('#license-url-link').attr('href', neo4j_inc_license_url);
		$('#license-url-link').text('Terms of the Startup Program');
	}
}

/**
 * Post application in current form (id: startup-application)
 */
const postApplication = function (token) {
	/* Serialize data into JSON */
	const jsonData = $('#startup-application').serializeArray()
		.reduce(function (a, x) { a[x.name] = x.value; return a; }, {});

	/* Return ajax for callback chaining */
	return $.ajax
		({
			type: "POST",
			url: API_BASE_URL + "apply",
			contentType: "application/json",
			dataType: 'json',
			async: true,
			data: JSON.stringify(jsonData),
			headers: {
				"Authorization": token
			}
		});
}

/**
 * Get applications previously submitted by current user
 */
const getApplications = function (token) {
	/* Return ajax for callback chaining */
	return $.ajax
		({
			type: "GET",
			url: API_BASE_URL + 'getApplications',
			async: true,
			headers: {
				"Authorization": token
			}
		});
}

/**
 * Get Neo4j versions to display in download 
 */
const getDownloads = function () {
	return $.ajax
		({
			type: "GET",
			url: "/current-neo4j-versions/"
		});
}


$(document).ready(function () {
	Foundation.reInit('equalizer');

	$.validator.methods.agree = function (value, element) {
		return this.optional(element) || /^AGREE$/.test(value);
	}


	/* Register validation handler */
	$("#startup-application").validate({
		rules: {
			"terms-agree": "agree"
		},
		messages: {
			"terms-agree": "You must type AGREE in this field to agree to terms"
		},
		submitHandler: function (form) {
			/* TODO move into success and failure cases */
			postApplication(window._neo4jStartup.accessToken)
				.fail(function (jqXHR, textStatus, errorThrown) {
					alert("Failed submitting application. (" + jqXHR.statusText + "). Contact startups@neo4j.com if this problem persists.");
				})
				.done(
					function (data) {
						$('.pre-apply').hide();
						$('.application').hide();
						$('#application-id').text("Application ID: " + data['application-id']);
						document.body.scrollTop = document.documentElement.scrollTop = 0;
						$('#load-startup-home-button').click(
							function () {
								window.location.reload(true);
								return false;
							}
						)
						$('.post-apply').show();
						$('.available-downloads').hide();
						$('.existing-applications').hide();
					}
				);
		}
	});

	/* Register button to submit form */
	$('#startup-application-button').click(
		function () {
			$("#startup-application").submit();
			return false;
		}
	);

	/* Register button to sign in*/
	$('#application-signin').click(
		function () {
			console.log('clicked button');
			const currentLocation = [location.protocol, '//', location.host, location.pathname].join('');
			window.location = 'https://neo4j.com/accounts/login-b/?targetUrl=' + encodeURI(currentLocation + '?action=continue');
			return false;
		}
	);

	/* Register button to sign out*/
	$('.application-signout').click(
		function () {
			window.location = 'https://neo4j.com/accounts/logout/?targetUrl=' + encodeURI(window.location);
			return false;
		}
	);

	$('#application-toggle-button').click(
		function () {
			$('.pre-apply').hide();
			$('.post-apply').hide();
			$('.application').show();
			$('.application-toggle').hide();
			Foundation.reInit('equalizer');
		}
	);

	auth.checkSession({}, (err, result) => {
		try {
			if (err) {
				$('.pre-apply').show();
				$('.application').hide();
				$('.loading-icon').hide();
				Foundation.reInit('equalizer');
				return;
			}

			const token = result.idToken;
			const userProfile = result.idTokenPayload;

			window._neo4jStartup.accessToken = token;

			$('.pre-apply').hide();
			$('.loading-icon').show();
			getApplications(token)
				.fail(function (jqXHR, textStatus, errorThrown) {
					console.log(jqXHR, textStatus, errorThrown)
					alert("Failed retrieving existing apps. (" + jqXHR.statusText + "). Contact startups@neo4j.com if this persists.");
				})
				.done(function (data) {
					if (data['applications'].length > 0) {
						var approvedApps = 0;
						data['applications'].forEach(function (app) {
							var newListItem = $('#existing-applications-list-header').clone();
							newListItem.find('.app-date').text(truncateDateTime(app['created_date']));
							newListItem.find('.app-company-name').text(app['company_name']);
							newListItem.find('.app-status').text(app['status']);
							newListItem.find('.app-licenses').text('');
							newListItem.find('.license-expires').text(truncateDateTime(app['expires_date']));
							for (var keyid in app['license_keys']) {
								const key = app['license_keys'][keyid];
								newListItem.find('.app-licenses').append('<a target="_blank" href="view-license?date=' + key['license_date'] + '&feature=' + key['licensed_feature'] + '">' + key['licensed_feature'].replace('neo4j-', '') + '</a> &nbsp;');
							}
							newListItem.insertAfter('#existing-applications-list-header');
							if (app['status'] == 'APPROVED') {
								approvedApps = approvedApps + 1;
							}
						});
						if (token) {
							$('.existing-applications').show();
							$('.application').hide();
							$('.application-toggle').show();
							$('.loading-icon').hide();
							if (approvedApps > 0) {
								getDownloads()
									.done(function (data) {
										var jsonData = JSON.parse(data);
										var rowId = 0;
										var insertAfter = 'available-downloads-list-header';
										jsonData.forEach(function (download) {
											var newListItem = $('#available-downloads-list-header').clone();
											newListItem.attr('id', 'available-downloads-list-row' + rowId);
											newListItem.find('.release-product').text('Enterprise Server');
											newListItem.find('.release-date').html('<div style="width: 140px; text-align: right">' + download['release_date'] + '</div>');
											newListItem.find('.release-version').text(download['neo4j_version']);
											newListItem.find('.download-link').html('<a target="_blank" href="https://neo4j.com/download-thanks/?edition=enterprise&flavour=unix&release=' + download['neo4j_version'] + '">UNIX/Linux</a>&nbsp;&nbsp; <a target="_blank" href="https://neo4j.com/download-thanks/?edition=enterprise&flavour=windows&release=' + download['neo4j_version'] + '">Windows</a>');
											newListItem.insertAfter('#' + insertAfter);
											insertAfter = 'available-downloads-list-row' + rowId;
											rowId = rowId + 1;
										});
										$('.available-downloads').show();
									});
							}
							Foundation.reInit('equalizer');
						} else {
							$('.pre-apply').show();
							$('.application').hide();
							$('.loading-icon').hide();
							Foundation.reInit('equalizer');
						}
					} else if (data['applications'].length == 0) {
						if (token) {
							$('.existing-applications').hide();
							$('.application').show();
							$('.loading-icon').hide();
							Foundation.reInit('equalizer');
						} else {
							$('.pre-apply').show();
							$('.loading-icon').hide();
							$('.application').hide();
							Foundation.reInit('equalizer');
						}
					}
				});
			$('#first-name').val(userProfile.given_name);
			$('#last-name').val(userProfile.family_name);
			$('#email').val(userProfile.email);
		} catch (e) {
			console.log('error');
			console.log(e);
		}
	})
}); // end document.ready() handler
