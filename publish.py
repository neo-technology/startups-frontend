from base64 import b64encode
import json
import requests
import sys, getopt
import os
import boto3
import flask
from flask import render_template

fapp = flask.Flask('pub', template_folder='.')

'''
Publish file to S3 and get version
'''
def publish_js():
  # Create an S3 client
  s3 = boto3.client('s3')
  file = open('js/app.js')
  f = s3.put_object(Body=file, Bucket='cdn.neo4jlabs.com', Key='startups-v2/app.js', ACL='public-read')
  return f['VersionId']


'''
Get page content
'''
def get_page_content(filename):
  file = open('html/%s' % filename)
  return file.read()

'''
Update wordpress page
'''
def update_wordpress_page(pageId, content):
    url = 'https://neo4j.com/wp-json/wp/v2/pages/%d' % (pageId)
    auth = b64encode('{}:{}'.format(os.getenv('PUBLISH_DOCS_USERNAME'), os.getenv('PUBLISH_DOCS_PASSWORD')))
    headers = {
        'Accept': 'application/json',
        'Authorization': 'Basic {}'.format(auth),
    }

    r = requests.get(url, headers=headers)
    response = json.loads(r.content)

    # build response for update
    response['content'] = content
    headers['Content-Type'] = 'application/json'
    print url
    pr = requests.post(url, headers=headers, data=json.dumps(response))

    return pr.content


def main(argv):
  stage = 'dev'
  try:
     opts, args = getopt.getopt(argv,"h",['stage='])
  except getopt.GetoptError:
     print 'publish.py --stage <stage>'
     sys.exit(2)
  for opt, arg in opts:
     if opt == '-h':
        print 'publish.py --stage <stage>'
        sys.exit()
     elif opt in ("--stage"):
        stage = arg
  print 'Stage is "%s"' % (stage)

  if stage == 'dev':
    print "Stage 'prod' is only supported stage currently"
    sys.exit()

  if 'PUBLISH_DOCS_USERNAME' in os.environ and 'PUBLISH_DOCS_PASSWORD' in os.environ:
    # publish new JS
    versionId = publish_js()

    # publish wordpress page, replacing version of JS with latest published
    with fapp.app_context():
      tmpl_vars = {'js_version': versionId}
      rendered_content = render_template('html/index.html', **tmpl_vars)
      pageContent = update_wordpress_page(87812, rendered_content)
  else:
    print "Environment varisbles for PUBLISH_DOCS_USERNAME and PUBLISH_DOCS_PASSWORD must be set"
    sys.exit()

if __name__ == "__main__":
   main(sys.argv[1:])

