import { Bloc, ScheletGrila } from "@/components/Schelete";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <Bloc className="h-4 w-64" />
      <div className="grid lg:grid-cols-2 gap-8 mt-4">
        <Bloc className="w-full aspect-[100/72]" />
        <div>
          <Bloc className="h-3 w-36" />
          <Bloc className="h-8 w-4/5 mt-3" />
          <Bloc className="h-4 w-2/3 mt-3" />
          {/* Nouă rânduri de specificații, cât are pagina adevărată. */}
          <div className="card mt-5 divide-y divide-chenar">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3">
                <Bloc className="h-4 w-32 shrink-0" /><Bloc className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Bloc className="h-7 w-64 mt-12 mb-5" />
      <ScheletGrila cate={8} />
    </div>
  );
}
