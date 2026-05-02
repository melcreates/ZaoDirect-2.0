export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Upload is too large. Please upload smaller photos or fewer files.",
    });
  }

  res.status(500).json({ message: "Internal server error" });
}
