export async function GET() {
  return Response.json({
    name: "coperto-platform",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
