#!/usr/bin/env bash

cd $(dirname "${BASH_SOURCE[0]}")
set -euxo pipefail

# for node_modules/@sourcegraph/tsconfig/tsconfig.json
pushd ../..
yarn --mutex network install
popd

pushd web/
yarn --mutex network install
yarn run build
popd
