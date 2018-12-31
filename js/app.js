var country = null;
var state = null;

var geoOnSuccess = function(geoipResponse) {
  country = geoipResponse.country.names.en;
  if (geoipResponse.subdivisions.length > 0) {
    // state = geoipResponse.subdivisions[0].iso_code;
    state = geoipResponse.subdivisions[0].names.en;
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
    url: "https://q6kkptbenj.execute-api.us-east-1.amazonaws.com/dev/apply",
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
    url: "https://q6kkptbenj.execute-api.us-east-1.amazonaws.com/dev/getApplications",
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

  getApplications().done(
    function (data) {
      if (data['applications'].length > 0) {
        data['applications'].forEach(function (app) {
          var newListItem = $('#existing-applications-list-header').clone();  
          newListItem.find('.app-date').text(app['created_timestamp']);
          newListItem.find('.app-company-name').text(app['company_name']);
          newListItem.find('.app-status').text(app['email']);
          newListItem.insertAfter('#existing-applications-list-header');
        });
        $('.existing-applications').show();
        $('.application').hide();
        $('.application-toggle').show();
      }
    }
  );

  /* Register validation handler */
  $("#startup-application").validate({
    submitHandler: function(form) {
      /* TODO move into success and failure cases */
      postApplication().done(
        function(data) {
          $('.pre-apply').hide();
          $('.application').hide();
          $('#application-id').text( "Application ID: " + data['application-id'] );
          document.body.scrollTop = document.documentElement.scrollTop = 0;
          $('.post-apply').show();
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

  $('#application-toggle-button').click( 
    function() {
      $('.application').show();
      $('.application-toggle').hide();
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
  }

  if (userInfo && id_token && !id_token_expired) {
    var qsmap = parseQueryString();
    if ('action' in qsmap && qsmap['action'][0] == 'continue') {
      $('#first-name').val( userInfo.given_name );
      $('#last-name').val( userInfo.family_name );
      $('#email').val( userInfo.email );
      $('.pre-apply').hide();
    } else {
      $('.pre-apply').show();
      $('.application').hide();
    }
  } else {
    $('.pre-apply').show();
  }

}); // end document.ready() handler
