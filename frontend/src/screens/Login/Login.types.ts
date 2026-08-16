export interface LoginFormValues {
  username: string;
  password: string;
}

export interface LoginFieldErrors {
  username?: string;
  password?: string;
  form?: string;
}
