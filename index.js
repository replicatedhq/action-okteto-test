import core from '@actions/core';
import axios from 'axios';
import { setInterval } from 'timers/promises';

const OKTETO_API = 'https://replicated.okteto.dev/graphql';
const OKTETO_TOKEN = core.getInput('token')
const PREVIEW_NAME = core.getInput('branch');

const fetchPreviewStatus = (previewId) => {
    const statusQuery = {
        query: `
query {
    preview(id: "${previewId}") {
        gitDeploys {
            status
        }
    }
}`
    }
    return axios.post(OKTETO_API, statusQuery);
}

const destroyPreview = (previewId) => {
    const destroyPreviewMutation = {
        query: `
mutation{
   destroyPreview(id: "${previewId}"){
       id
   }
}`
    }
    return axios.post(OKTETO_API, destroyPreviewMutation)

}

const deployPreviewMutation = {
    query: `
mutation{
    deployPreview(
        name: "${PREVIEW_NAME}"
        scope: global
        repository: "https://www.github.com/replicatedhq/kots"
        branch: "${PREVIEW_NAME}"
    ){
        id
    }
}`
}

axios.defaults.headers['Authorization'] = `Bearer ${OKTETO_TOKEN}`;

core.info(`Creating preview ${PREVIEW_NAME}`);
const deployPreviewMutationResponse = await axios.post(OKTETO_API, deployPreviewMutation);
const previewId = deployPreviewMutationResponse.data.data.deployPreview.id;
core.info(`previewId ${previewId}`);

const apiStatusChecker = setInterval(10000);
for await (const _ of apiStatusChecker) {
    const statusQueryResponse = await fetchPreviewStatus(previewId);
    const status = statusQueryResponse.data?.data?.preview?.gitDeploys[0]?.status
    core.info(`Status ${status}`);
    if (status === 'error') {
        core.setFailed('Error deploying pipeline to Okteto.')
        break;
    }
    if (status === 'deployed') {
        break
    }
}

core.info(`Destroying preview ${PREVIEW_NAME}`);
const destroyPreviewMutationResponse = await destroyPreview(previewId);
