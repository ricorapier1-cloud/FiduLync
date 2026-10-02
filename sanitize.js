const fs = require("fs");
const path = require("path");

function sanitizeFormInputs(dir) {
  if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
          const fullPath = path.join(dir, file.name);
              if (file.isDirectory()) {
                    sanitizeFormInputs(fullPath);
                        } else if (file.name.endsWith(".tsx") || file.name.endsWith(".ts")) {
                              let content = fs.readFileSync(fullPath, "utf8");

                                    // 1. Replace real phone numbers in placeholder attributes with generic e.g. 08000000000
                                          let updated = content.replace(/placeholder=["'`\`](?:0[789][01]\d{8}|\+234[789][01]\d{8})["'`\`]/g, 'placeholder="e.g. 08000000000"');

                                                // 2. Clear real phone numbers in defaultValue or value attributes inside <input />
                                                      updated = updated.replace(/(defaultValue|value)=["'`\`](?:0[789][01]\d{8}|\+234[789][01]\d{8})["'`\`]/g, '$1=""');

                                                            // 3. Clear initial state numbers in useState(...)
                                                                  updated = updated.replace(/useState\(["'`\`](?:0[789][01]\d{8}|\+234[789][01]\d{8})["'`\`]\)/g, 'useState("")');

                                                                        if (updated !== content) {
                                                                                fs.writeFileSync(fullPath, updated);
                                                                                        console.log("✅ Sanitized phone input boxes in:", fullPath);
                                                                                              }
                                                                                                  }
                                                                                                    }
                                                                                                    }

                                                                                                    sanitizeFormInputs("app");
                                                                                                    sanitizeFormInputs("components");
                                                                                                    console.log("✅ Input sanitization complete!");