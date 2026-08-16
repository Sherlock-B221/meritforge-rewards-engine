export interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
}

export interface RegisterFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  form?: string;
}
