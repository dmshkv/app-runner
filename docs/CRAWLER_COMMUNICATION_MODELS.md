# Crawler Communication Models - Architecture Comparison

## Current State
- Crawler Lambda triggered by EventBridge
- Processes one URL, extracts data, then terminates
- Each invocation requires a new cold/warm start

## Objective
Keep the crawler running after successful crawl to await next commands (new URL or exit signal) instead of terminating immediately.

---

## Communication Model Options

### 🏆 **Option 1: SQS Long Polling (RECOMMENDED)**

**Architecture:**
```
Client → SQS Queue → Lambda (long-running) → Processes → Polls SQS for next message
                                                ↓
                                         Publishes results to SNS/EventBridge
```

**How it works:**
1. Lambda starts and processes initial crawl request from SQS
2. After completion, publishes results (SNS/EventBridge/S3)
3. **Long polls** SQS queue for next message (up to 20 seconds wait time)
4. Receives new crawl URL or exit command
5. Repeats until timeout (15 min Lambda limit) or explicit exit signal

**Pros:**
- ✅ Native AWS service, serverless, fully managed
- ✅ Guaranteed message delivery (at-least-once)
- ✅ Dead Letter Queue (DLQ) for failed messages
- ✅ FIFO queues available for ordered processing
- ✅ Long polling reduces API calls and costs
- ✅ Decouples producer/consumer
- ✅ Auto-scales based on queue depth
- ✅ Battle-tested for production workloads
- ✅ Message visibility timeout prevents duplicate processing

**Cons:**
- ⚠️ Lambda 15-minute timeout limit (need to exit before timeout)
- ⚠️ Additional SQS costs (minimal: $0.40 per 1M requests)
- ⚠️ Message size limit (256 KB)

**Cost:** ~$0.40 per 1M messages + Lambda compute time

**Best for:** Production workloads requiring reliability, order, and scale

---

### Option 2: Lambda Reserved Concurrency + EventBridge

**Architecture:**
```
Client → EventBridge → Lambda (reserved concurrency=1) → Polls EventBridge
                                        ↓
                                  Publishes results to EventBridge
```

**How it works:**
1. Lambda with reserved concurrency = 1 (single instance)
2. Processes events from EventBridge
3. Polls EventBridge for new events using `GetEvents` API
4. Continues processing until timeout or exit event

**Pros:**
- ✅ No additional queue infrastructure
- ✅ Uses existing EventBridge setup
- ✅ Native event routing and filtering

**Cons:**
- ❌ EventBridge doesn't support long polling
- ❌ Need to implement polling loop (API calls every few seconds)
- ❌ More expensive (EventBridge API calls)
- ❌ No message persistence (events are ephemeral)
- ❌ No DLQ or retry mechanism
- ❌ Reserved concurrency limits scaling

**Cost:** EventBridge events: $1.00 per 1M events (higher than SQS)

**Best for:** Not recommended for continuous polling

---

### Option 3: Step Functions + SQS

**Architecture:**
```
Client → Step Functions → Lambda (crawl) → SQS → Lambda (await) → Repeat
                              ↓
                        Publishes results
```

**How it works:**
1. Step Functions orchestrates workflow
2. Lambda executes crawl
3. Waits for next SQS message in Step Functions `Task` state
4. Loops until exit signal or max iterations

**Pros:**
- ✅ Visual workflow management
- ✅ Built-in retry and error handling
- ✅ Long-running workflows (up to 1 year)
- ✅ State management included
- ✅ Can combine multiple Lambdas

**Cons:**
- ⚠️ More complex architecture
- ⚠️ Additional costs (Step Functions: $25 per 1M state transitions)
- ⚠️ Overkill for simple queue processing

**Cost:** $25 per 1M state transitions + SQS + Lambda

**Best for:** Complex multi-step workflows with orchestration needs

---

### Option 4: AWS IoT Core (MQTT)

**Architecture:**
```
Client → IoT Core (MQTT topic) → Lambda (subscribes) → Processes → Waits
                                          ↓
                                    Publishes to topic
```

**How it works:**
1. Lambda subscribes to MQTT topic via IoT Core
2. Receives real-time messages
3. Processes and publishes results to another topic
4. Keeps connection alive for new messages

**Pros:**
- ✅ Real-time, bi-directional communication
- ✅ Low latency (milliseconds)
- ✅ Persistent connections
- ✅ Pub/sub pattern

**Cons:**
- ❌ Overkill for this use case
- ❌ Lambda doesn't natively support persistent MQTT connections
- ❌ Higher complexity
- ❌ More expensive for request/response patterns

**Cost:** $1.00 per 1M messages + connection fees

**Best for:** IoT devices, real-time dashboards, WebSocket replacements

---

### Option 5: API Gateway WebSocket + Lambda

**Architecture:**
```
Client → API Gateway (WebSocket) → Lambda → Processes → Sends via connectionId
```

**How it works:**
1. Client establishes WebSocket connection
2. Sends crawl requests over persistent connection
3. Lambda processes and responds via same connection
4. Connection stays open for subsequent requests

**Pros:**
- ✅ True bi-directional communication
- ✅ Real-time responses
- ✅ Persistent connection

**Cons:**
- ❌ Requires client to maintain WebSocket connection
- ❌ Lambda still has 15-min timeout
- ❌ Not suitable for async batch processing
- ❌ More complex client implementation

**Cost:** $1.00 per 1M messages + connection minutes

**Best for:** Interactive applications, chat, live updates

---

### Option 6: DynamoDB Streams + Polling

**Architecture:**
```
Client → DynamoDB (insert) → DynamoDB Streams → Lambda → Processes → Polls DynamoDB
```

**How it works:**
1. Client writes crawl requests to DynamoDB
2. Lambda triggered by DynamoDB Stream
3. Processes request and marks as complete
4. Polls DynamoDB for next pending request

**Pros:**
- ✅ Built-in event sourcing
- ✅ Audit trail of all requests
- ✅ Can query historical data

**Cons:**
- ⚠️ Polling DynamoDB is inefficient (read capacity units)
- ⚠️ Not designed for queue-like operations
- ⚠️ Need to manage request status manually
- ⚠️ More expensive than SQS

**Cost:** DynamoDB reads + writes (higher than SQS)

**Best for:** Event sourcing, audit trails, not for queuing

---

## 📊 Comparison Matrix

| Criteria | SQS | EventBridge | Step Functions | IoT Core | WebSocket | DynamoDB |
|----------|-----|-------------|----------------|----------|-----------|----------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Cost** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Latency** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Use Case Fit** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## 🎯 Recommendation: **SQS Long Polling**

### Why SQS?
1. **Perfect fit** for queue-based worker pattern
2. **Battle-tested** for exactly this use case
3. **Cost-effective** - lowest cost per message
4. **Simple** - minimal code changes needed
5. **Reliable** - DLQ, retries, visibility timeout built-in
6. **Scalable** - handles millions of messages automatically

### Implementation Strategy

#### 1. Architecture Changes

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ Submit crawl request
       ▼
┌─────────────────┐
│  SQS Queue      │
│  (Commands)     │
└────────┬────────┘
         │
         │ Trigger (or manual poll)
         ▼
┌─────────────────────────────────┐
│  Lambda (Crawler)               │
│  ┌───────────────────────────┐  │
│  │ 1. Process message        │  │
│  │ 2. Crawl & extract        │  │
│  │ 3. Publish results (SNS)  │  │
│  │ 4. Delete message         │  │
│  │ 5. Long poll for next     │  │
│  │    (up to 20s wait)       │  │
│  │ 6. If message: goto 1     │  │
│  │ 7. If timeout: exit       │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         │ Publish results
         ▼
┌─────────────────┐
│  SNS Topic      │
│  (Results)      │
└─────────────────┘
```

#### 2. Message Types

**Crawl Request:**
```json
{
  "type": "CRAWL",
  "url": "https://example.com",
  "selectors": { ... },
  "options": { ... }
}
```

**Exit Command:**
```json
{
  "type": "EXIT"
}
```

#### 3. Lambda Modifications

**New flow:**
1. Lambda receives initial SQS message (auto-trigger)
2. Processes crawl
3. Publishes results to SNS
4. Deletes message from SQS
5. **Long polls SQS** for next message (20-second wait)
6. If message received, repeat from step 2
7. If no message after timeout or explicit EXIT, gracefully shutdown
8. If approaching 15-min Lambda limit, exit with message returned to queue

#### 4. Benefits Over Current Approach

**Before:**
- 1 crawl = 1 Lambda invocation
- Cold start on each request
- Chromium loads each time (~2-3 seconds overhead)

**After:**
- 1 Lambda instance handles N crawls
- Browser stays open between crawls
- Amortize cold start across multiple URLs
- 10x+ throughput improvement

#### 5. Cost Comparison

**Current (EventBridge):**
- 100 crawls = 100 Lambda invocations
- Cold starts: ~200-300 seconds wasted
- EventBridge: $0.0001 = ~$0.01

**Proposed (SQS Long Polling):**
- 100 crawls = ~10 Lambda invocations (10 URLs per instance)
- Cold starts: ~20-30 seconds wasted
- SQS: 200 requests (send + receive) = $0.00008
- **90% reduction in cold start time**
- **Similar costs, much better performance**

---

## 📋 Implementation Checklist

### Phase 1: Infrastructure (CDK)
- [ ] Add SQS queue for crawl commands
- [ ] Add SQS DLQ for failed messages
- [ ] Add SNS topic for results (or keep EventBridge)
- [ ] Update Lambda IAM role for SQS permissions
- [ ] Configure SQS as Lambda event source (or manual polling)

### Phase 2: Lambda Code
- [ ] Add SQS polling loop in Lambda handler
- [ ] Implement message processing (CRAWL vs EXIT)
- [ ] Add graceful shutdown logic (timeout monitoring)
- [ ] Publish results to SNS after each crawl
- [ ] Delete processed messages from SQS
- [ ] Add error handling and DLQ routing

### Phase 3: Testing
- [ ] Test single crawl (baseline)
- [ ] Test multiple crawls in sequence
- [ ] Test EXIT command
- [ ] Test timeout handling (13-min mark)
- [ ] Load test (100+ URLs queued)
- [ ] Test DLQ for failures

### Phase 4: Monitoring
- [ ] CloudWatch metrics (queue depth, processing time)
- [ ] Alarms for DLQ messages
- [ ] Dashboard for throughput
- [ ] Cost tracking

---

## Next Steps

1. **Approve architecture** → SQS Long Polling
2. **Update CDK stack** → Add SQS queue and SNS topic
3. **Modify Lambda** → Add polling loop
4. **Test locally** → Simulate queue with array
5. **Deploy dev** → Test end-to-end
6. **Monitor & optimize** → Tune timeout/polling intervals

---

## Alternative: Hybrid Approach

If you want to **keep EventBridge as trigger** but add queuing:

```
EventBridge → Lambda (initial) → SQS → Lambda (polls) → Repeat
```

This maintains backward compatibility while adding queue-based continuation.

**Trade-off:** Extra Lambda invocation but keeps existing EventBridge patterns.
