#!/usr/bin/env python
# vim: set sw=4 ts=4 et:
# * easy_install google-api-python-client
# https://developers.google.com/drive/web/quickstart/quickstart-python

import argparse
import httplib2
import json
import logging
import random
import StringIO
import sys

from apiclient.discovery import build
from apiclient.errors import HttpError
from apiclient.http import MediaIoBaseUpload
from oauth2client.client import OAuth2WebServerFlow
from oauth2client.file import Storage

# Copy your credentials from the console
CLIENT_ID = 'YOURIDHERE.apps.googleusercontent.com'
CLIENT_SECRET = 'YOUR_SECRET_HERE'

# Check https://developers.google.com/drive/scopes for all available scopes
OAUTH_SCOPE = ' '.join(('https://www.googleapis.com/auth/drive',
         'https://www.googleapis.com/auth/drive.scripts'))

# Redirect URI for installed apps
REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

def get_credentials():
    storage = Storage('a_credentials_file')
    credentials = storage.get()

    if credentials is None:
        # Run through the OAuth flow and retrieve credentials
        flow = OAuth2WebServerFlow(CLIENT_ID, CLIENT_SECRET, OAUTH_SCOPE,
                redirect_uri=REDIRECT_URI)
        authorize_url = flow.step1_get_authorize_url()
        print 'Go to the following link in your browser: ' + authorize_url
        code = raw_input('Enter verification code: ').strip()
        credentials = flow.step2_exchange(code)
        storage.put(credentials)

    return credentials

def get_args():
    parser = argparse.ArgumentParser(description='Process some integers.')
    parser.add_argument('command', metavar='COMMAND', type=str,
            choices=('get', 'put'),
            help='a command: get, put')
    parser.add_argument('doc_id', metavar='DOC_ID', type=str,
            help='script.google.com document ID')
    parser.add_argument('filename', metavar='FILENAME', type=str,
            help='either foo.gs or foo.html')
    parser.add_argument('-v', '--verbose', action="count",
            help="increase output verbosity (e.g., -vv is more than -v)")
    return parser.parse_args()

def main():
    args = get_args()
    logging.basicConfig()

    credentials = get_credentials()

    # Create an httplib2.Http object and authorize it with our credentials
    http = httplib2.Http()
    http = credentials.authorize(http)
    drive_service = build('drive', 'v2', http=http)

    result = drive_service.files().list().execute()
    other_files = []
    file_to_update = None

    filecontent = sys.stdin.read()

    for item in result['items']:
        if item['id'] == args.doc_id:
            url = item['exportLinks'][
                'application/vnd.google-apps.script+json']
            _, content = http.request(url, "GET")
            files = json.loads(content)
            name, ext = args.filename.rsplit('.', 1)
            file_type = {
                'gs': 'server_js',
                'html': 'html',
            }[ext.lower()]
            for the_file in files['files']:
                del the_file['id']
                if the_file['type'] == file_type and the_file['name'] == name:
                    if args.command == 'get':
                        print the_file['source']
                    elif args.command == 'put':
                        the_file['source'] = filecontent
                    file_to_update = the_file
                else:
                    other_files.append(the_file)

            if file_to_update is None:
                file_to_update = {
                    'name': name,
                    'type': file_type,
                    'source': filecontent,
                }

    if args.command == 'put':
        # Clean out old files
        upload = {'files': [{'name': 'file%s' % random.random(),
           'type': 'html',
           'source': 'temporary file',
        }]}
        content = json.dumps(upload)
        assert isinstance(content, str)
        print "Clearing out files"
        file_pointer = StringIO.StringIO(content)
        media = MediaIoBaseUpload(file_pointer,
              mimetype='application/vnd.google-apps.script+json')
        try:
            request = drive_service.files().update(
                  fileId=args.doc_id,
                  media_body=media)
            request.execute()
        except HttpError, error:
            print error.resp
            print error.content

        # Upload everything again
        other_files.append(file_to_update)
        upload = {'files': other_files}
        content = json.dumps(upload)
        print "Uploading new file"
        assert isinstance(content, str)
        file_pointer = StringIO.StringIO(content)
        media = MediaIoBaseUpload(file_pointer,
              mimetype='application/vnd.google-apps.script+json')
        try:
            request = drive_service.files().update(
                    fileId=args.doc_id,
                    media_body=media)
            request.execute()
        except HttpError, error:
            print error.resp
            print error.content

if __name__ == "__main__":
    main()
