import { Bloc } from "@/components/Schelete";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Bloc className="h-4 w-56" />
      <Bloc className="h-9 w-72 mt-4" />
      <Bloc className="h-4 w-full max-w-2xl mt-3" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Bloc className="w-full aspect-[4/3] rounded-none" />
            <div className="p-3.5"><Bloc className="h-4 w-3/4" /><Bloc className="h-3 w-1/2 mt-2" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
