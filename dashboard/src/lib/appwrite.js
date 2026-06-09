import { Account, Client, ID, OAuthProvider } from 'appwrite';

const endpoint = process.env.REACT_APP_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID || '69e7d0a0002573ec6840';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

const account = new Account(client);

export async function pingAppwrite() {
  try {
    await account.get();
    return { success: true, message: 'Appwrite session verified' };
  } catch (error) {
    if (error?.code === 401) {
      return { success: true, message: 'Appwrite reachable; no active session' };
    }
    return { success: false, message: error.message || 'Connection failed', error };
  }
}

export {
  account,
  client,
  endpoint,
  ID,
  OAuthProvider,
  projectId
};
