import handlebars from 'handlebars';
import { readFile, readdir } from 'fs-extra';
import path from 'path';

// Register partials as before
const registerPartials = async (): Promise<void> => {
  const partialsDir = path.join(__dirname, '../templates/partials');
  const files = await readdir(partialsDir);

  for (const file of files) {
    const partialPath = path.join(partialsDir, file);
    const partialName = path.basename(file, '.hbs');
    const partialContent = await readFile(partialPath, 'utf-8');
    handlebars.registerPartial(partialName, partialContent);
  }
};

// Compile and render templates with a layout
export const compileTemplateWithLayout = async (layoutName: string, templateName: string, data: Record<string, any>): Promise<string> => {
  await registerPartials();

  const layoutPath = path.join(__dirname, '../templates/layouts', `${layoutName}.hbs`);
  const layoutSource = await readFile(layoutPath, 'utf-8');
  handlebars.registerPartial('layout', layoutSource); // Register the layout as a partial

  const templatePath = path.join(__dirname, '../templates/pages', `${templateName}.hbs`);
  const templateSource = await readFile(templatePath, 'utf-8');
  const template = handlebars.compile(templateSource);

  // Render the main template and insert it into the layout
  const renderedTemplate = template(data);
  return handlebars.compile('{{> layout }}')({ body: renderedTemplate });
};
