export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        How to Use the Fantasy Rankings API
      </h1>
      <p className="mb-4">
        The Fantasy Rankings API provides player rankings based on different
        scoring formats. You can retrieve data by making GET requests to the
        following endpoint:
      </p>
      <pre className="bg-gray-100 p-4 rounded mb-4">
        <code className="text-blue-600">
          GET /api/rankings?scoring=SCORING_TYPE
        </code>
      </pre>
      <p className="font-semibold mb-2">Query Parameters:</p>
      <ul className="list-disc list-inside mb-4">
        <li>
          <span className="font-semibold">scoring</span> (required): The scoring
          format you want to retrieve rankings for. Acceptable values are:
          <ul className="list-disc list-inside pl-6 mt-2">
            <li>
              <code className="text-blue-600">PPR</code> - Point Per Reception
            </li>
            <li>
              <code className="text-blue-600">HALF</code> - Half Point Per
              Reception
            </li>
            <li>
              <code className="text-blue-600">STANDARD</code> - Standard Scoring
            </li>
          </ul>
        </li>
      </ul>
      <p className="mb-4">Example request:</p>
      <pre className="bg-gray-100 p-4 rounded mb-4">
        <code className="text-blue-600">
          GET /api/rankings?scoring=STANDARD
        </code>
      </pre>
      <p>
        This request will return a JSON object with player rankings based on
        standard scoring.
      </p>
    </div>
  );
}
