export interface UserStateData {
  csrfToken: string;
  isLoggedIn: boolean | null;
  isLoading: boolean;

  id?: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;

  isAdmin: boolean;
}