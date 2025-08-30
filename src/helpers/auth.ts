
type User = any; // TODO

interface UseAuthCallbackOptions {
  accessToken?: string | null;
  refreshToken?: string | null;
  login: (accessToken: string, user: User) => void;
  navigate: (path: string) => void;
  type?: string | null;
  next?: string;
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}

export function handleAuthCallback({
  accessToken,
  refreshToken,
  login,
  navigate,
  type,
  next = '/',
  error,
}: UseAuthCallbackOptions) {
  async function finalizeSession() {
    if (error) {
      navigate('/auth/error');
      return;
    }

    if (!accessToken || !refreshToken) {
      navigate('/library');
      return;
    }

    // TODO
    // const { error: err } = await auth.setSession({
    //   access_token: accessToken,
    //   refresh_token: refreshToken,
    // });

    // if (err) {
    //   console.error('Error setting session:', err);
    //   navigate('/auth/error');
    //   return;
    // }

    // todo
    // const {data: { user }} = await auth.getUser();
    // if (user) {
    //   login(accessToken, user);
    //   if (type === 'recovery') {
    //     navigate('/auth/recovery');
    //     return;
    //   }
    //   navigate(next);
    // } else {
    //   console.error('Error fetching user data');
    //   navigate('/auth/error');
    // }
  }

  finalizeSession();
}
