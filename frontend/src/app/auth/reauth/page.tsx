import React from 'react';

export default function ReauthPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0088cc]">IDR</h1>
      </div>

      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-gray-100 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sesión cerrada correctamente</h2>

        <a
          href="/auth/sso?callbackUrl=/"
          className="inline-flex w-full items-center justify-center space-x-2 rounded-md bg-[#0088cc] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0077b3] transition-colors"
        >
          <span>Volver a iniciar sesión</span>
        </a>
      </div>
    </div>
  );
}
