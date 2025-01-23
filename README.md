## Scripts

The following scripts are available in the project:

* **test** - Runs the project tests. If no tests are specified, it will exit with an error message.
* **start** - Starts the project in production mode.
* **start:dev** - Starts the project in development mode.
* **start:local** - Starts the project in local development mode using Nodemon to watch for changes in the source code.
* **build:development** - Builds the project in development mode.
* **build** - Builds the project in production mode.

**How to use the scripts:**

```bash
# Run the project tests
npm test

# Start the project in production mode
npm start

# Start the project in development mode
npm start:dev

# Start the project in local development mode
npm start:local

# Build the project in development mode
npm run build:development

# Build the project in production mode
npm run build