export default function Card({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-50 max-w-100 hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}
