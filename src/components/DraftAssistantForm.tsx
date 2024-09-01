import React from "react";
import { RefreshButton } from "@/components/RefreshButton";
import {
  UseFormRegister,
  FieldErrors,
  UseFormHandleSubmit,
} from "react-hook-form";

interface FormData {
  userId: string;
  draftId: string;
}

interface DraftAssistantFormProps {
  register: UseFormRegister<FormData>;
  handleSubmit: UseFormHandleSubmit<FormData>;
  onSubmit: (data: FormData) => void;
  errors: FieldErrors<FormData>;
  isSubmitting: boolean;
  userIdError: string | null;
  draftIdError: string | null;
}

export default function DraftAssistantForm({
  register,
  handleSubmit,
  onSubmit,
  errors,
  isSubmitting,
  userIdError,
  draftIdError,
}: DraftAssistantFormProps) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-4">
      <div className="mb-4">
        <label htmlFor="userId" className="block mb-2">
          User ID
        </label>
        <input
          id="userId"
          {...register("userId")}
          className="border p-2 rounded w-full mb-2 text-black"
        />
        {errors.userId && (
          <p className="text-red-500">{errors.userId.message}</p>
        )}
        <details className="mb-4">
          <summary className="text-lg font-semibold cursor-pointer">
            How to Find Your Sleeper User ID
          </summary>
          <div className="mt-2 p-4 bg-gray-800 border rounded text-white">
            <p className="mb-2">
              To manually find your Sleeper User ID, follow these steps:
            </p>
            <ol className="list-decimal list-inside mb-2">
              <li className="mb-2">
                Go to your web browser and visit the following URL:
                <br />
                <code className="block bg-gray-900 p-2 rounded mt-1 text-green-400">
                  https://api.sleeper.app/v1/user/{"<your_username>"}
                </code>
              </li>
              <li className="mt-2">
                Replace <code>{"<your_username>"}</code> with your actual
                Sleeper username. (e.g.,{" "}
                <code>https://api.sleeper.app/v1/user/example</code>)
              </li>
              <li className="mt-2">
                Press Enter, and you should see a JSON response.
              </li>
              <li className="mt-2">
                Look for the <code>&quot;user_id&quot;</code> field in the JSON
                response. It will look something like this:
                <pre className="bg-gray-900 p-3 rounded mt-2 text-green-400">
                  {'{\n  "user_id": "861000413091057664",\n  ...\n}'}
                </pre>
              </li>
              <li className="mt-2">
                Copy the value of <code>&quot;user_id&quot;</code>—this is your
                Sleeper User ID.
              </li>
            </ol>
            <p className="mt-2">
              Use this User ID when prompted in the app to proceed with the
              draft assistant features.
            </p>
          </div>
        </details>
      </div>
      <div className="mb-4">
        <label htmlFor="draftId" className="block mb-2">
          Draft ID
        </label>
        <input
          id="draftId"
          {...register("draftId")}
          className="border p-2 rounded w-full mb-2 text-black"
        />
        {errors.draftId && (
          <p className="text-red-500">{errors.draftId.message}</p>
        )}
      </div>
      <RefreshButton loading={isSubmitting} />
      {userIdError && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{userIdError}</span>
        </div>
      )}
      {draftIdError && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{draftIdError}</span>
        </div>
      )}
    </form>
  );
}
