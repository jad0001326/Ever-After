export default function PlanningHubLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-48 rounded-full bg-[#e7dfd2]" />
      <div className="mt-5 h-16 max-w-3xl rounded-2xl bg-[#e7dfd2]" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <div className="h-[34rem] rounded-3xl bg-[#e7dfd2]" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => <div className="h-80 rounded-3xl bg-[#e7dfd2]" key={index} />)}
        </div>
        <div className="h-[30rem] rounded-3xl bg-[#e7dfd2]" />
      </div>
    </div>
  );
}
