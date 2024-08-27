// src/components/PositionNeeds.tsx

interface PositionNeedsProps {
  userPositionNeeds: Record<string, number>;
  userPositionCounts: Record<string, number>;
  draftWideNeeds: Record<string, number>;
}

export default function PositionNeeds({
  userPositionNeeds,
  userPositionCounts,
  draftWideNeeds,
}: PositionNeedsProps) {
  const positions = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
  const categories = [
    { label: "Your Team Needs", data: userPositionNeeds },
    { label: "Your Team Counts", data: userPositionCounts },
    { label: "Draft-Wide Needs", data: draftWideNeeds },
  ];

  return (
    <div className="mt-6">
      <table className="min-w-full bg-white text-black">
        <thead>
          <tr>
            <th className="py-2 px-4 border">Category</th>
            {positions.map((position) => (
              <th key={position} className="py-2 px-4 border">
                {position}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.label}>
              <td className="py-2 px-4 border">{category.label}</td>
              {positions.map((position) => (
                <td key={position} className="py-2 px-4 border">
                  {category.data[position] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
