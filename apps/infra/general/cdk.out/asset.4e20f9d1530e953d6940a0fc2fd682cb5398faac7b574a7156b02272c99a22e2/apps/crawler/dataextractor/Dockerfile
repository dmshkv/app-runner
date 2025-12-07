# Multi-stage build for AWS Lambda with Puppeteer
FROM public.ecr.aws/lambda/nodejs:20 AS builder

# Install dependencies needed for building
WORKDIR /build

# Copy package files
COPY package*.json ./
COPY nx.json tsconfig*.json ./

# Copy the dataextractor app
COPY apps/crawler/dataextractor ./apps/crawler/dataextractor/

# Install all dependencies (including dev for building)
RUN npm ci

# Build the application using Nx
RUN npx nx build dataextractor --prod


# Production stage
FROM public.ecr.aws/lambda/nodejs:20

# Install chromium dependencies for Lambda
RUN dnf install -y \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    alsa-lib \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    at-spi2-atk \
    libXt \
    xorg-x11-server-Xvfb \
    xorg-x11-xauth \
    dbus-glib \
    dbus-glib-devel \
    nss \
    mesa-libgbm \
    && dnf clean all

# Copy built application from builder
COPY --from=builder /build/dist/apps/crawler/dataextractor ${LAMBDA_TASK_ROOT}

# Copy node_modules (only production dependencies)
COPY --from=builder /build/node_modules ${LAMBDA_TASK_ROOT}/node_modules

# Set the handler (using SQS-based handler)
CMD [ "main-sqs.handler" ]
