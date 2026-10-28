export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: unknown;
}

export interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  photo: string;
  cover: string;
}

export interface AuthData {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string; 
  user: User;
}

export interface SignupRequest {
  name: string;
  username?: string;
  email: string;
  dateOfBirth: string; 
  gender: 'male' | 'female';
  password: string;
  rePassword: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}