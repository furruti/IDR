'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef } from 'react';

type Props = {
  callbackUrl: string;
  isBypass?: boolean;
};

export default function AutoSignIn({ callbackUrl, isBypass = false }: Props) {
  const hasCalled = useRef(false);

  useEffect(() => {
    if (!hasCalled.current) {
      hasCalled.current = true;
      const provider = isBypass ? 'credentials' : 'keycloak';
      // Llamar a next-auth client-side signIn
      signIn(provider, { callbackUrl });
    }
  }, [callbackUrl, isBypass]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0088cc]">IDR</h1>
        <p className="mt-2 text-sm text-gray-500">Autenticación requerida</p>
      </div>

      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Iniciar sesión</h2>
        <p className="mt-2 text-sm text-gray-500 mb-6">
          {isBypass 
            ? 'Bypass activado. Iniciando sesión automáticamente...' 
            : 'Serás redirigido a Keycloak para autenticarte.'}
        </p>

        <button
          disabled
          className="flex w-full items-center justify-center space-x-2 rounded-md bg-[#66c2d1] px-4 py-3 text-sm font-semibold text-white opacity-80"
        >
          <svg
            className="h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>{isBypass ? 'Autenticando...' : 'Redirigiendo...'}</span>
        </button>
      </div>
    </div>
  );
}
