import { apiGet, apiPost, apiPut, apiDelete } from './api';

// Multi-address management — shares the Marketplace backend /users/addresses/
// endpoints, so saved addresses stay in sync with the website and the user app.

function unwrapList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.data?.results)) return res.data.results;
  return [];
}

export async function fetchAddresses() {
  const res = await apiGet('/users/addresses/');
  return unwrapList(res);
}

export async function createAddress(payload) {
  return apiPost('/users/addresses/', payload);
}

export async function updateAddress(id, payload) {
  return apiPut(`/users/addresses/${id}/`, payload);
}

export async function deleteAddressById(id) {
  return apiDelete(`/users/addresses/${id}/`);
}

export async function makeAddressDefault(id) {
  return apiPost(`/users/addresses/${id}/set-default/`, {});
}
