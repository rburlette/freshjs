// Calls the RealWorld API. A failed request throws an error with the HTTP status and the API's
// error messages; an error without a status means the API couldn't be reached or answered nonsense.
const base = '/api';

export async function api(method, path, body) {
	let headers = {'Content-Type': 'application/json'}, token = localStorage.getItem('jwtToken');
	if(token)
		headers.Authorization = 'Token ' + token;

	let response = await fetch(base + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
	let text = await response.text(), json = null;

	try {
		json = text ? JSON.parse(text) : null;
	} catch(error) {
		if(response.ok)
			throw error;
	}

	if(!response.ok)
		throw Object.assign(new Error(method + ' ' + path + ' failed with ' + response.status), {status: response.status, errors: json?.errors});

	return json;
}

// {errors: {email: ["can't be blank"]}} becomes ["email can't be blank"]
export function errorMessages(error) {
	if(!error.status)
		return ['Unable to connect. Please check your connection and try again.'];

	let messages = Object.entries(error.errors || {}).flatMap(([field, list]) => [].concat(list).map(message => field + ' ' + message));
	return messages.length ? messages : ['Something went wrong. Please try again.'];
}
