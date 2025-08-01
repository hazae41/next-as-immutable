import fs from "fs"
import path from "path"

export function* walkSync(directory: string): Generator<string> {
  const files = fs.readdirSync(directory, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(directory, file.name))
    } else {
      yield path.join(directory, file.name)
    }
  }
}
