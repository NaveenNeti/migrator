# Migrator Builder

The Migrator Builder is a TypeScript utility designed to facilitate the migration of data from one source to another, offering a flexible and customizable approach. It supports streaming data, conditional processing, hooks for lifecycle events, error handling, and both dry and actual runs.

## Features

- **Streaming Data Support**: Efficiently handles large datasets by streaming data instead of loading it all at once.
- **Conditional Processing**: Allows for conditional logic to determine if a row should be processed.
- **Lifecycle Hooks**: Offers hooks for executing custom logic at different stages of the migration process.
- **Error Handling**: Robust error handling mechanism to manage and recover from errors during migration.
- **Dry Run Capability**: Supports dry runs to preview the outcome of a migration without making actual changes.

## Installation

To use Migrator Builder, ensure you have Node.js installed. Then, add it to your project:

```bash
npm install migrator-builder
```

## Usage

### Basic Setup

1. **Import Migrator Builder:**

```typescript
import { MigratorBuilder } from 'migrator-builder';
```

2. **Create an Instance and Configure:**

Mandatory setters required are:
- loadData
- setGetUniqueKey
- setIsMigratedPredicate
- setProcessElement

### Default Values
FILL OUT

```typescript
type Row = {
    id: string,
    name: string
};

const migrator = new MigratorBuilder<Row>()
    .loadData(async function* () {
        // Implementation for streaming data of type Row
    })
    .processElement(async (row: Row, dryRun) => {
        // Implementation for processing each row
    })
    .setIsMigratedPredicate((row: Row) => {
        // Return true to process the row, false to skip
        // Used to determine if a row has been migrated already 
        // Allows for repeated, incremental or interrupted migrations
    });
```

#### Executing Migration

To start the migration process, call the `executeMigration` method. You can specify whether to perform a dry run by setting the `dryRun` property before execution.

```typescript
await migrator.executeMigration();
```

## Advanced Configuration
The builder pattern allows for a fluent and intuitive setup of the migration process, including conditional processing, hooks, phantom row detection and error handling. Each method returns the builder instance, enabling the chaining of configuration calls.

### Error Handling
The Migrator Builder is designed to **optionally** gracefully handle errors. It keeps track of the number of consecutive errors and the last successfully processed row. Implement the `errorHook` for custom error handling strategies.

### DryRun Mode
FILL OUT

### Hooks
FILL OUT

### Phantom Row Detection
FILL OUT

## Conclusion
The Migrator Builder offers a robust and flexible framework for data migration tasks. By leveraging its streaming capabilities, lifecycle hooks, and error handling mechanisms, developers can tailor the migration process to meet their specific requirements. ```