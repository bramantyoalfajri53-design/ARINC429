import { api } from "../../../shared";
import { getCfdsApiPath } from "../utils";

export const cfdsApi = {
  fetchStatus: <T>() => api<T>(getCfdsApiPath("/status")),
};
