# Testing Documentation

## Overview
This document outlines the testing strategy and available test commands for the CDP Agent Kit. Our testing suite covers bot functionality, agent capabilities, service integrations, and unit tests.

## Test Commands

### Main Commands

#### Complete Test Suite
```bash
npm run test:all
```
Runs all test suites sequentially, including unit, integration, bot, and agent tests. Use this for complete system verification before deployments.

#### Coverage Testing
```bash
npm run test:coverage
```
Generates detailed coverage metrics and creates reports in the `./coverage` directory. Use this to identify areas needing additional test coverage.

#### CI/CD Testing
```bash
npm run test:ci
```
Specific command for continuous integration pipelines. Includes coverage reporting and JUnit reporter output.

### Individual Test Suites

#### Unit Tests
```bash
npm run test:unit
```
Location: `src/services/__tests__/unit`
- Tests individual service components
- Verifies core functionality
- Fast execution for quick feedback

#### Integration Tests
```bash
npm run test:integration
```
Location: `src/services/__tests__/integration`
- Tests service interactions
- Verifies API integrations
- Validates component compatibility

#### Bot Tests
```bash
npm run test:bot
```
Location: `src/services/__tests__/bot`
Tests:
- Discord command validation
- Telegram command validation
- Wallet verification flow
- Rate limiting
- Error handling

#### Agent Tests
```bash
npm run test:agent
```
Location: `src/services/__tests__/agent`
Tests:
- Content creation and promotion
- Token distribution
- Challenge system
- Cross-platform integration
- Error handling and retries

#### Watch Mode
```bash
npm run test:watch
```
Runs tests in watch mode, automatically re-running on file changes. Ideal for development.

## Test Coverage

### Coverage Metrics
Our test suite measures:
- Line Coverage: Percentage of code lines executed
- Branch Coverage: Percentage of code branches executed
- Function Coverage: Percentage of functions called
- Statement Coverage: Percentage of statements executed

### Coverage Goals
- Overall Coverage Target: 80%
- Critical Services Target: 90%
- Bot Commands Target: 95%

## Running Tests

### Prerequisites
1. Ensure all dependencies are installed:
```bash
npm install
```

2. Set up required environment variables:
```bash
cp .env.example .env
```

3. Configure test database/Redis if required

### Step-by-Step Testing Process

1. Start with unit tests:
```bash
npm run test:unit
```

2. Run integration tests:
```bash
npm run test:integration
```

3. Test bot functionality:
```bash
npm run test:bot
```

4. Test agent capabilities:
```bash
npm run test:agent
```

5. Generate coverage report:
```bash
npm run test:coverage
```

### Analyzing Results

After running tests:
1. Check console output for test results
2. Review coverage report in `./coverage/lcov-report/index.html`
3. Address any failing tests
4. Identify areas needing additional coverage

## Writing New Tests

### Test File Structure
```typescript
describe('Feature Category', () => {
    beforeEach(() => {
        // Setup
    });

    describe('Specific Feature', () => {
        test('should behave in specific way', () => {
            // Test implementation
        });
    });

    afterEach(() => {
        // Cleanup
    });
});
```

### Best Practices
1. Use descriptive test names
2. Follow AAA pattern (Arrange, Act, Assert)
3. Mock external dependencies
4. Test edge cases and error conditions
5. Keep tests focused and atomic

## Troubleshooting

### Common Issues
1. **Failing Tests**
   - Check test environment setup
   - Verify mocks and stubs
   - Review recent code changes

2. **Low Coverage**
   - Identify uncovered code paths
   - Add missing test cases
   - Review edge cases

3. **Slow Tests**
   - Optimize test setup
   - Reduce unnecessary mocks
   - Use appropriate test categories

## Maintenance

### Regular Tasks
1. Review and update tests with code changes
2. Monitor coverage metrics
3. Optimize test performance
4. Update documentation as needed

### Continuous Integration
Tests are automatically run on:
- Pull requests
- Merges to main branch
- Release builds 