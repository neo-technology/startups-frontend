Sentry.init({ dsn: 'https://9a2dd82a420e4115aca3cc605e6131f7@sentry.io/1385360' });



var country = null;
var state = null;
var continent = null;

var API_BASE_URL = "{{API_BASE_URL}}";

var truncateDateTime = function(dateTimeStr) {
  if (typeof dateTimeStr == 'string') {
    return dateTimeStr.substring(0,10); 
  } else {
    return dateTimeStr;
  }
}

var geoOnSuccess = function(geoipResponse) {
  country = geoipResponse.country.names.en;
  if (geoipResponse.subdivisions.length > 0) {
    // state = geoipResponse.subdivisions[0].iso_code;
    state = geoipResponse.subdivisions[0].names.en;
  }
  continent = geoipResponse.continent.code;
  if (continent == 'EU') {
    $('#license-url').val(neo4j_ab_license_url);
    $('#license-url-link').attr('href', neo4j_ab_license_url);
  } else {
    $('#license-url').val(neo4j_inc_license_url);
    $('#license-url-link').attr('href', neo4j_inc_license_url);
  }
}

var geoOnError = function(error) {
  console.log(error);
}

// Call geolocation early
geoip2.city( geoOnSuccess, geoOnError );


var getTimeDiff = function(time1, time2) {
  var hourDiff = time2 - time1;
  var diffDays = Math.floor(hourDiff / 86400000);
  var diffHrs = Math.floor((hourDiff % 86400000) / 3600000);
  var diffMins = Math.floor(((hourDiff % 86400000) % 3600000) / 60000);
  return {"days": diffDays, "hours": diffHrs, "mins": diffMins};
}

/**
 * Post application in current form (id: startup-application)
 */
var postApplication = function() {
  /* Serialize data into JSON */
  var jsonData = $('#startup-application').serializeArray()
    .reduce(function(a, x) { a[x.name] = x.value; return a; }, {});

  /* Auth token */
  var id_token = Cookies.get("com.neo4j.accounts.idToken");

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
       "Authorization": id_token
    }
  });
}

/**
 * Get applications previously submitted by current user
 */
var getApplications = function() {
  /* Auth token */
  var id_token = Cookies.get("com.neo4j.accounts.idToken");

  /* Return ajax for callback chaining */
  return $.ajax
  ({
    type: "GET",
    url: API_BASE_URL + 'getApplications',
    async: true,
    headers: {
       "Authorization": id_token
    }
  });
}


$(document).ready(function() {  
  var userInfo = Cookies.getJSON("com.neo4j.accounts.userInfo");
  var id_token = Cookies.get("com.neo4j.accounts.idToken");
  var id_token_expired = true;


  $.validator.methods.agree = function( value, element ) {
    return this.optional( element ) || /^AGREE$/.test( value );
  }


  /* Register validation handler */
  $("#startup-application").validate({
    rules: {
      "terms-agree": "agree"
    },
    messages: {
      "terms-agree": "You must type AGREE in this field to agree to terms"
    },
    submitHandler: function(form) {
      /* TODO move into success and failure cases */
      postApplication().done(
        function(data) {
          $('.pre-apply').hide();
          $('.application').hide();
          $('#application-id').text( "Application ID: " + data['application-id'] );
          document.body.scrollTop = document.documentElement.scrollTop = 0;
          $('.post-apply').show();
          $('.existing-applications').hide();
        }
      ); 
    }
  });

  /* Register button to submit form */
  $('#startup-application-button').click( 
    function() {
      $("#startup-application").submit();
      return false;
    }
  );

  /* Register button to sign in*/
  $('#application-signin').click( 
    function() {
      currentLocation = [location.protocol, '//', location.host, location.pathname].join('');
      window.location = 'https://neo4j.com/accounts/login/?targetUrl=' + encodeURI(currentLocation + '?action=continue');
      return false;
    }
  );

  /* Register button to sign out*/
  $('.application-signout').click( 
    function() {
      window.location = 'https://neo4j.com/accounts/logout/?targetUrl=' + encodeURI(window.location);
      return false;
    }
  );

  $('#application-toggle-button').click( 
    function() {
      $('.pre-apply').hide();
      $('.post-apply').hide();
      $('.application').show();
      $('.application-toggle').hide();
      Foundation.reInit('equalizer');
    }
  );

  var expiresIn = null;
  if (id_token) {
    expiresIn = getTimeDiff(Date.now(), (jwt_decode(id_token).exp) * 1000); 
    if ( (expiresIn.days > 0) || (expiresIn.hours > 0) || (expiresIn.mins > 0)) {
      id_token_expired = false;
    }  else {
      id_token_expired = true;
    } 
  } else {
    $('.pre-apply').show();
    Foundation.reInit('equalizer');
  }

  if (userInfo && id_token && !id_token_expired) {
    var qsmap = parseQueryString();
    $('.pre-apply').hide();
    getApplications()
      .fail( function (jqXHR, textStatus, errorThrown) {
        alert("Failed retrieving existing apps. (" + jqXHR.statusText + "). Contact startups@neo4j.com if this persists.");
      })
      .done( function (data) {
        if (data['applications'].length > 0) {
          data['applications'].forEach(function (app) {
            //var d = new Date(app['created_timestamp']);
            var newListItem = $('#existing-applications-list-header').clone();  
            //newListItem.find('.app-date').text(d.toLocaleString().split(",")[0]);
            newListItem.find('.app-date').text(truncateDateTime(app['created_date']));
            newListItem.find('.app-company-name').text(app['company_name']);
            newListItem.find('.app-status').text(app['status']);
            newListItem.find('.app-licenses').text('');
            newListItem.find('.license-expires').text(truncateDateTime(app['expires_date']));
            for (keyid in app['license_keys']) {
              key = app['license_keys'][keyid];
              newListItem.find('.app-licenses').append('<a target="_blank" href="view-license?date=' + key['license_date'] + '&feature=' + key['licensed_feature'] + '">' + key['licensed_feature'] + '</a> ');
            }
            newListItem.insertAfter('#existing-applications-list-header');
          });
          if ('action' in qsmap && qsmap['action'][0] == 'continue') {
            $('.existing-applications').show();
            $('.application').hide();
            $('.application-toggle').show();
            Foundation.reInit('equalizer');
          } else {
            $('.pre-apply').show();
            $('.application').hide();
            Foundation.reInit('equalizer');
          }
        } else if (data['applications'].length == 0) {
          if ('action' in qsmap && qsmap['action'][0] == 'continue') {
            $('.existing-applications').hide();
            $('.application').show();
            Foundation.reInit('equalizer');
          } else {
            $('.pre-apply').show();
            $('.application').hide();
            Foundation.reInit('equalizer');
          }
        }
      }
    );
    $('#first-name').val( userInfo.given_name );
    $('#last-name').val( userInfo.family_name );
    $('#email').val( userInfo.email );
  } else {
    $('.pre-apply').show();
    $('.application').hide();
    Foundation.reInit('equalizer');
  }

}); // end document.ready() handler
