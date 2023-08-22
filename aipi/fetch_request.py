import requests
from aipi.authentication import parse_auth_headers

def fetch_request(api_url, llm, auth_headers_template, user_credentials):
    # Substitute user credentials into the authentication headers
    auth_headers = [[header[0], header[1].format(key=user_credentials)] for header in auth_headers_template]

    # Construct and execute the fetch request
    response = requests.get(api_url, headers=dict(auth_headers))

    # Pass the response to the LLM
    llm.process_response(response)

    return response